# Stateless Orchestrator — Tech Spec

## Motivation

The orchestrator currently holds in-memory state: a `running` Map of active agent runs and a `claimed` Set for dedup. This couples it to the Next.js process, meaning:

- **No restart tolerance** — a deploy or crash loses all running-state tracking.
- **No separation** — the orchestrator cannot run as an independent worker process.
- **No horizontal scaling** — multiple instances would each hold divergent state.

This spec moves all orchestrator state into the database so the orchestrator becomes a stateless loop that can be restarted, scaled, or relocated without coordination.

---

## OrchestratorEvent Table

A new append-only table captures every orchestrator-relevant event.

### Schema

| Column      | Type                   | Notes                                     |
|-------------|------------------------|-------------------------------------------|
| `id`        | `String` (cuid)        | Primary key                               |
| `boardId`   | `String`               | FK to Board                               |
| `cardId`    | `String`               | FK to Card                                |
| `runId`     | `String?`              | FK to AgentRun, nullable                  |
| `type`      | `String`               | Free-form string, not a DB enum (see below) |
| `payload`   | `Json`                 | JSONB — event-specific data               |
| `createdAt` | `DateTime`             | Server-set timestamp                      |

### Indexes

| Index                              | Purpose                          |
|------------------------------------|----------------------------------|
| `[cardId, createdAt]`             | SSE tailing — fetch events for a card since a cursor |
| `[boardId, type, createdAt]`      | Reconciler — query control events per board          |

### Why `String` type, not a DB enum

Event types will evolve frequently during development. A string column avoids migration churn every time a new type is added. Validation happens in application code.

### Event Types

**Orchestrator-control events** (inputs to the orchestrator loop):

| Type              | Trigger                        | Payload               |
|-------------------|--------------------------------|-----------------------|
| `card_moved`      | Card dragged to a new column   | `{ fromColumn, toColumn }` |
| `card_unblocked`  | Human replies on a blocked card | `{ reply }` |

**Agent-output events** (emitted during agent execution):

| Type              | Description                              |
|-------------------|------------------------------------------|
| `agent_message`   | Text content from the agent              |
| `agent_thinking`  | Thinking/reasoning trace                 |
| `tool_use`        | Tool invocation details                  |
| `card_update`     | Agent requests a card field change       |
| `card_blocked`    | Agent signals it needs human input       |
| `status_change`   | Run status transition                    |
| `error`           | Error during execution                   |
| `done`            | Run completed                            |

---

## SKIP LOCKED Dispatch

Card dispatch uses `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction to claim work:

```sql
BEGIN;
  SELECT * FROM "Card"
  WHERE "columnType" = 'IN_PROGRESS'
    AND "id" NOT IN (SELECT "cardId" FROM "AgentRun" WHERE "status" IN ('running', 'idle'))
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  -- If a row is returned, create the AgentRun in the same transaction
  INSERT INTO "AgentRun" (...) VALUES (...);
COMMIT;
```

This guarantees that two orchestrator instances cannot claim the same card. If instance A locks card X, instance B's query skips it and picks the next eligible card (or returns nothing).

No application-level `claimed` Set is needed — the database is the single source of truth for claim state.

---

## Query-Based Reconciliation

The current `running` Map is replaced by a query each tick:

```sql
SELECT ar.*, c."boardId"
FROM "AgentRun" ar
JOIN "Card" c ON ar."cardId" = c."id"
WHERE ar."status" IN ('running', 'idle');
```

Each tick, the orchestrator:

1. Queries active runs (above).
2. For each run, checks whether the underlying process is still alive / the session is still active.
3. If a run has no live process, marks it as `failed` with a timeout reason.

This removes the need to keep an in-memory map synchronized with DB state. The DB is always authoritative.

---

## Event-Driven Signaling

Today, `notifyCardMoved()` and `notifyCardUnblocked()` call directly into the orchestrator's in-memory state. In the new model they simply insert events:

```ts
async function notifyCardMoved(cardId: string, fromColumn: string, toColumn: string) {
  await prisma.orchestratorEvent.create({
    data: {
      boardId,
      cardId,
      type: 'card_moved',
      payload: { fromColumn, toColumn },
    },
  });
}
```

The orchestrator's next tick picks up unprocessed `card_moved` and `card_unblocked` events and acts on them. Handlers are idempotent — processing the same event twice produces the same result (e.g., moving an already-moved card is a no-op).

---

## SSE Endpoint

### Current state

The SSE endpoint subscribes to an in-memory `EventEmitter` / broadcaster. Events are lost on restart and cannot be replayed.

### New design

The SSE endpoint polls the `OrchestratorEvent` table on a ~500ms interval:

```
GET /api/boards/:boardId/cards/:cardId/events?since=<cursor>
```

- `since` is the `id` (or `createdAt`) of the last event the client received.
- On reconnect, the client passes its last-seen cursor via the `?since=` query parameter, receiving any events it missed.
- The endpoint streams events as SSE `data:` frames, one per event row.

### Why not LISTEN/NOTIFY

PostgreSQL's `LISTEN/NOTIFY` would give sub-millisecond latency, but it is **incompatible with connection pooling** (PgBouncer, Prisma's connection pool). A pooled connection may be returned to the pool and reassigned, silently dropping the LISTEN subscription. Polling at 500ms is simple, reliable, and sufficient for the UI update cadence.

---

## AbortController Removal

Currently, `interruptSession()` uses an `AbortController` to forcibly kill agent streams. This creates cleanup complexity and race conditions.

In the new model:

1. An `interruptSession()` call inserts a `status_change` event with payload `{ status: 'terminated' }`.
2. The agent execution loop checks for termination events between tool calls.
3. On seeing a termination event, the loop exits naturally — no `AbortController`, no signal propagation.

This is safer because the agent completes its current atomic operation before stopping, avoiding partial writes or orphaned resources.

---

## Migration Strategy

A phased rollout avoids a flag-day cutover:

### Phase 1 — Dual Write

- Create the `OrchestratorEvent` table and deploy the migration.
- Modify the existing broadcaster to **also** write events to the DB.
- SSE continues reading from the in-memory broadcaster.
- Validates that events are being persisted correctly.

### Phase 2 — Switch SSE to DB Polling

- SSE endpoint switches from broadcaster subscription to DB polling.
- Verify reconnection with `?since=` works correctly.
- The broadcaster still fires (for any other consumers), but SSE no longer depends on it.

### Phase 3 — Remove Broadcaster

- Remove the in-memory broadcaster, `EventEmitter`, and the `running` / `claimed` data structures.
- The orchestrator is now fully stateless.
- All state lives in `Card`, `AgentRun`, and `OrchestratorEvent` tables.

Each phase is independently deployable and rollback-safe.
