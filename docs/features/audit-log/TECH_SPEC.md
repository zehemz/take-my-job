# Audit Log Technical Spec

**Project:** Kobani
**Date:** 2026-04-14
**Status:** Draft

---

## 1. Overview

Add an immutable, append-only audit log that records every significant mutation in the system. Events are written by API route handlers via a fire-and-forget helper and exposed through a paginated, filterable read-only API. An admin-only UI page provides a browsable table of events.

### Goals

- Record all card, agent, environment, board, RBAC, and system events with actor, timestamp, and contextual metadata.
- Provide a paginated `GET /api/audit-log` endpoint with filtering by entity type, entity ID, actor, and date range.
- Build an admin-only `/audit-log` page with a table and filter bar.
- Keep audit recording non-blocking — never slow down or fail the primary mutation.

### Non-goals

- Undo/revert functionality.
- Real-time streaming (SSE/WebSocket) of audit events.
- Webhook delivery of events to external systems.
- Retention policies or automatic pruning.
- Full-text search across metadata.

---

## 2. Database Schema

### New Prisma model

```prisma
model AuditLog {
  id           String   @id @default(cuid())
  action       String   // e.g. 'card.created', 'agent.edited', 'group.member_added'
  entityType   String   // 'card' | 'agent' | 'environment' | 'board' | 'user' | 'group' | 'agent_run'
  entityId     String   // ID of the affected entity
  actorUsername String  // GitHub username of the person who performed the action, or 'system'
  metadata     Json     // Arbitrary JSON with action-specific context
  createdAt    DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorUsername])
  @@index([createdAt])
  @@index([action])
}
```

### Design decisions

| Decision | Rationale |
|----------|-----------|
| **Single table, not per-entity tables** | Simpler schema, single query for the audit log page, easy to add new entity types without migrations. |
| **`action` as a plain string, not a Prisma enum** | New actions can be added without a migration. Validation happens in the `recordAudit()` helper at the TypeScript level. |
| **`metadata` as JSON** | Each action type has different contextual data. A structured JSON column avoids dozens of nullable columns. |
| **`actorUsername` instead of `actorId` (FK to User)** | The audit log must survive user deletion. If a user is removed, their events remain readable with their GitHub username. A foreign key would either cascade-delete events (bad) or block user deletion (annoying). |
| **No FK to any entity table** | Same reasoning — entities get deleted, but their audit trail must persist. `entityType` + `entityId` is a soft reference. |
| **`createdAt` only, no `updatedAt`** | Audit events are immutable. They are never updated or deleted. |

### Indexes

- **`(entityType, entityId)`** — filter events for a specific entity ("show me all events for card X").
- **`actorUsername`** — filter events by actor ("show me everything user Y did").
- **`createdAt`** — sort by time (default) and filter by date range.
- **`action`** — filter by action type ("show me all card.moved events").

### Storage estimate

Each audit event is roughly 200-500 bytes (cuid ID + short strings + small JSON metadata). At 1,000 events/day, the table grows by ~150KB/day or ~55MB/year. Well within PostgreSQL's comfort zone without partitioning or archival for several years.

---

## 3. Action Catalog

All actions are namespaced as `<entityType>.<verb>`.

### Card actions

| Action | entityType | entityId | Metadata shape |
|--------|-----------|----------|----------------|
| `card.created` | `card` | card ID | `{ boardId: string, columnId: string, title: string, role: string \| null }` |
| `card.moved` | `card` | card ID | `{ fromColumnId: string, toColumnId: string, fromColumnName?: string, toColumnName?: string }` |
| `card.approved` | `card` | card ID | `{ approvedBy: string }` |
| `card.revision_requested` | `card` | card ID | `{ reason: string }` |
| `card.deleted` | `card` | card ID | `{ title: string, boardId: string }` |
| `card.retried` | `card` | card ID | `{ attempt: number }` |
| `card.replied` | `card` | card ID | `{ message: string }` (truncated to 200 chars) |
| `card.edited` | `card` | card ID | `{ changedFields: string[] }` |

### Agent actions

| Action | entityType | entityId | Metadata shape |
|--------|-----------|----------|----------------|
| `agent.edited` | `agent` | anthropicAgentId | `{ changedFields: string[], previousValues: Record<string, unknown> }` |
| `agent.deleted` | `agent` | anthropicAgentId | `{ name: string, role: string \| null }` |

### Environment actions

| Action | entityType | entityId | Metadata shape |
|--------|-----------|----------|----------------|
| `environment.created` | `environment` | environment ID | `{ name: string }` |
| `environment.edited` | `environment` | environment ID | `{ changedFields: string[] }` |
| `environment.deleted` | `environment` | environment ID | `{ name: string }` |

### Board actions

| Action | entityType | entityId | Metadata shape |
|--------|-----------|----------|----------------|
| `board.created` | `board` | board ID | `{ name: string }` |
| `board.deleted` | `board` | board ID | `{ name: string }` |

### RBAC actions

| Action | entityType | entityId | Metadata shape |
|--------|-----------|----------|----------------|
| `user.created` | `user` | user ID | `{ githubUsername: string, isAdmin: boolean }` |
| `user.admin_toggled` | `user` | user ID | `{ githubUsername: string, isAdmin: boolean }` |
| `user.deleted` | `user` | user ID | `{ githubUsername: string }` |
| `group.created` | `group` | group ID | `{ name: string, agentRoles: string[], environments: string[] }` |
| `group.updated` | `group` | group ID | `{ changedFields: string[] }` |
| `group.deleted` | `group` | group ID | `{ name: string }` |
| `group.member_added` | `group` | group ID | `{ githubUsername: string, groupName: string }` |
| `group.member_removed` | `group` | group ID | `{ githubUsername: string, groupName: string }` |

### System actions

| Action | entityType | entityId | Metadata shape |
|--------|-----------|----------|----------------|
| `agent_run.started` | `agent_run` | run ID | `{ cardId: string, role: string, sessionId: string \| null, attempt: number }` |
| `agent_run.completed` | `agent_run` | run ID | `{ cardId: string, role: string, sessionId: string \| null }` |
| `agent_run.failed` | `agent_run` | run ID | `{ cardId: string, role: string, error: string }` (error truncated to 500 chars) |
| `agent_run.blocked` | `agent_run` | run ID | `{ cardId: string, role: string, blockedReason: string }` |

---

## 4. Recording Strategy

### `recordAudit()` helper

A single helper function called from API route handlers after the primary mutation succeeds. It is fire-and-forget: the caller does not `await` it, and failures are logged but never propagated.

```typescript
// lib/audit.ts

import { prisma } from '@/lib/db';

export type AuditEntityType =
  | 'card'
  | 'agent'
  | 'environment'
  | 'board'
  | 'user'
  | 'group'
  | 'agent_run';

export interface RecordAuditParams {
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  actorUsername: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record an audit log event. Fire-and-forget — does not throw.
 * Call this after the primary mutation has succeeded.
 *
 * Usage:
 *   recordAudit({
 *     action: 'card.moved',
 *     entityType: 'card',
 *     entityId: card.id,
 *     actorUsername: session.user.githubUsername,
 *     metadata: { fromColumnId: oldColumnId, toColumnId: newColumnId },
 *   });
 */
export function recordAudit(params: RecordAuditParams): void {
  prisma.auditLog
    .create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        actorUsername: params.actorUsername,
        metadata: params.metadata ?? {},
      },
    })
    .catch((err) => {
      console.error('[audit] Failed to record audit event:', {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
```

### Key design choices

1. **Fire-and-forget (no `await`).** The function returns `void`, not a `Promise`. The Prisma `.create()` runs asynchronously. If it fails, the error is logged to stderr but the API response has already been sent. This ensures audit logging never blocks or breaks the primary operation.

2. **Called after mutation, not before.** The audit event is recorded only after the database write succeeds. If the mutation fails (validation error, DB constraint violation), no phantom audit event is created.

3. **No transaction coupling.** The audit write is a separate Prisma call, not part of the mutation's `$transaction`. This keeps the mutation's transaction as fast as possible and avoids holding locks longer than necessary.

4. **Truncation in callers.** Long values (error messages, reply text) are truncated by the caller before passing to `recordAudit()`, not inside the helper. This keeps the helper simple and makes truncation explicit.

### Integration example

```typescript
// app/api/cards/[id]/move/route.ts (simplified)

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { columnId } = await req.json();
  const card = await prisma.card.findUnique({ where: { id: params.id } });
  if (!card) return Response.json({ error: 'Not found' }, { status: 404 });

  const oldColumnId = card.columnId;

  // ... existing move logic, validation, RBAC check ...
  const updated = await prisma.card.update({
    where: { id: params.id },
    data: { columnId },
  });

  // Fire-and-forget audit event
  recordAudit({
    action: 'card.moved',
    entityType: 'card',
    entityId: card.id,
    actorUsername: session.user.githubUsername,
    metadata: { fromColumnId: oldColumnId, toColumnId: columnId },
  });

  return Response.json(updated);
}
```

### System events (orchestrator)

System events (agent run started/completed/failed/blocked) are recorded from the orchestrator and agent runner, not from API route handlers. These use `actorUsername: 'system'` since they are not triggered by a direct human action.

```typescript
// lib/agent-runner.ts (simplified example)

recordAudit({
  action: 'agent_run.started',
  entityType: 'agent_run',
  entityId: run.id,
  actorUsername: 'system',
  metadata: {
    cardId: card.id,
    role: card.role,
    sessionId: run.sessionId,
    attempt: run.attempt,
  },
});
```

---

## 5. API Endpoint

### `GET /api/audit-log`

Paginated, filterable list of audit events. Admin-only.

#### Authentication and authorization

- Requires a valid session (`auth()` guard).
- Requires admin status (`requireAdmin()` guard).
- Returns 401 if no session, 403 if not admin.

#### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityType` | string | No | Filter by entity type (e.g., `card`, `agent`, `group`) |
| `entityId` | string | No | Filter by specific entity ID |
| `actorUsername` | string | No | Filter by actor GitHub username |
| `action` | string | No | Filter by action (e.g., `card.moved`) |
| `from` | ISO 8601 string | No | Start of date range (inclusive) |
| `to` | ISO 8601 string | No | End of date range (inclusive) |
| `cursor` | string | No | Pagination cursor (the `id` of the last item from the previous page) |
| `limit` | number | No | Page size, default 50, max 100 |

#### Response shape

```typescript
// lib/api-types.ts

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUsername: string;
  metadata: Record<string, unknown>;
  createdAt: string; // ISO 8601
}

export interface AuditLogListResponse {
  items: AuditLogEntry[];
  nextCursor: string | null; // null when no more pages
}
```

#### Pagination strategy

Cursor-based pagination using the `id` field (cuid, which is roughly time-ordered). The query orders by `createdAt DESC, id DESC` and uses a `WHERE (createdAt, id) < (cursor_createdAt, cursor_id)` condition for stable pagination even when new events are inserted between pages.

#### Implementation sketch

```typescript
// app/api/audit-log/route.ts

import { auth } from '@/auth';
import { requireAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import type { AuditLogListResponse } from '@/lib/api-types';

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const adminCheck = await requireAdmin(session.user.githubUsername);
  if (adminCheck) return adminCheck;

  const url = new URL(req.url);
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  const actorUsername = url.searchParams.get('actorUsername');
  const action = url.searchParams.get('action');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  const where: Record<string, unknown> = {};

  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (actorUsername) where.actorUsername = actorUsername;
  if (action) where.action = action;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  // Cursor-based pagination
  if (cursor) {
    const cursorRecord = await prisma.auditLog.findUnique({
      where: { id: cursor },
      select: { createdAt: true, id: true },
    });
    if (cursorRecord) {
      where.OR = [
        { createdAt: { lt: cursorRecord.createdAt } },
        {
          createdAt: cursorRecord.createdAt,
          id: { lt: cursorRecord.id },
        },
      ];
    }
  }

  const events = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // fetch one extra to determine if there's a next page
  });

  const hasMore = events.length > limit;
  const items = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const response: AuditLogListResponse = {
    items: items.map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      actorUsername: e.actorUsername,
      metadata: e.metadata as Record<string, unknown>,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor,
  };

  return Response.json(response);
}
```

---

## 6. TypeScript Types

### New types in `lib/api-types.ts`

```typescript
// ── Audit Log types ──────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUsername: string;
  metadata: Record<string, unknown>;
  createdAt: string; // ISO 8601
}

export interface AuditLogListResponse {
  items: AuditLogEntry[];
  nextCursor: string | null;
}
```

### Helper types in `lib/audit.ts`

```typescript
export type AuditEntityType =
  | 'card'
  | 'agent'
  | 'environment'
  | 'board'
  | 'user'
  | 'group'
  | 'agent_run';

export interface RecordAuditParams {
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  actorUsername: string;
  metadata?: Record<string, unknown>;
}
```

---

## 7. UI

### Page: `/audit-log`

Admin-only page. Non-admin users are redirected to `/`.

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Audit Log                                                   │
├──────────────────────────────────────────────────────────────┤
│  [Entity Type ▾]  [Actor ____]  [From ____]  [To ____]      │
├──────────────────────────────────────────────────────────────┤
│  Timestamp          Actor       Action            Entity     │
│  ─────────────────  ────────    ──────────────    ────────── │
│  2026-04-14 14:32   lucasbais  card.moved        card/abc   │
│  2026-04-14 14:30   lucasbais  card.created      card/def   │
│  2026-04-14 14:28   system     agent_run.started  run/ghi   │
│  2026-04-14 14:25   admin      user.created      user/jkl   │
│  ...                                                         │
│                                                              │
│  [Load more]                                                 │
└──────────────────────────────────────────────────────────────┘
```

#### Filter bar

- **Entity type dropdown**: options are `All`, `card`, `agent`, `environment`, `board`, `user`, `group`, `agent_run`.
- **Actor text input**: free-text input for GitHub username. Filters on submit (Enter or blur).
- **Date range**: two date inputs (`from` and `to`). Standard HTML date inputs for Phase 1.
- Filters update the URL query params and re-fetch from the API.

#### Table columns

| Column | Content |
|--------|---------|
| Timestamp | `createdAt` formatted as `YYYY-MM-DD HH:mm` in local time |
| Actor | `actorUsername` — displayed as plain text; `system` shown in a muted style |
| Action | `action` — formatted with a human-readable label (e.g., `card.moved` becomes "Card moved") |
| Entity | `entityType` + truncated `entityId` — clickable link to the entity when the entity still exists |
| Details | Summary extracted from `metadata` — e.g., "from Backlog to In Progress" for `card.moved` |

#### Pagination

- "Load more" button at the bottom of the table.
- Uses `nextCursor` from the API response.
- Button is hidden when `nextCursor` is null.
- Loading state on the button per ADR-006: disabled with "Loading..." text while fetching.

#### Empty state

When no events match the current filters: "No audit events found. Try adjusting your filters."

#### Access control (client-side)

- The page checks `session.user.isAdmin` (from the session, same pattern as `/access`).
- If not admin, redirect to `/` using Next.js `redirect()`.
- The API endpoint also enforces admin access server-side, so even if the client check is bypassed, the data is protected.

### Navigation

Add an "Audit Log" link to the top navigation bar, positioned after the existing "Access" link. The link is visible only when `session.user.isAdmin` is true, following the same pattern used for the "Access" link.

---

## 8. Files to Create or Modify

### New files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add `AuditLog` model (section 2) |
| `lib/audit.ts` | `recordAudit()` helper function and types (section 4) |
| `lib/api-types.ts` | Add `AuditLogEntry` and `AuditLogListResponse` types (section 6) |
| `app/api/audit-log/route.ts` | `GET` handler with pagination and filtering (section 5) |
| `app/audit-log/page.tsx` | Admin-only audit log page (section 7) |
| `app/audit-log/_components/AuditLogTable.tsx` | Table component with filter bar (section 7) |

### Modified files (add `recordAudit()` calls)

| File | Changes |
|------|---------|
| `app/api/boards/route.ts` | Add `board.created` event after `POST` |
| `app/api/boards/[id]/route.ts` | Add `board.deleted` event after `DELETE` |
| `app/api/boards/[id]/cards/route.ts` | Add `card.created` event after `POST` |
| `app/api/cards/[id]/route.ts` | Add `card.edited` event after `PATCH`, `card.deleted` after `DELETE` |
| `app/api/cards/[id]/move/route.ts` | Add `card.moved` event after move |
| `app/api/cards/[id]/approve/route.ts` | Add `card.approved` event |
| `app/api/cards/[id]/request-revision/route.ts` | Add `card.revision_requested` event |
| `app/api/cards/[id]/retry/route.ts` | Add `card.retried` event |
| `app/api/cards/[id]/reply/route.ts` | Add `card.replied` event |
| `app/api/agents/[id]/route.ts` | Add `agent.edited` and `agent.deleted` events |
| `app/api/environments/route.ts` | Add `environment.created` event |
| `app/api/environments/[id]/route.ts` | Add `environment.edited` and `environment.deleted` events |
| `app/api/admin/users/route.ts` | Add `user.created` event |
| `app/api/admin/users/[id]/route.ts` | Add `user.admin_toggled` and `user.deleted` events |
| `app/api/admin/groups/route.ts` | Add `group.created` event |
| `app/api/admin/groups/[id]/route.ts` | Add `group.updated` and `group.deleted` events |
| `app/api/admin/groups/[id]/members/route.ts` | Add `group.member_added` event |
| `app/api/admin/groups/[id]/members/[userId]/route.ts` | Add `group.member_removed` event |
| `lib/agent-runner.ts` | Add `agent_run.started`, `agent_run.completed`, `agent_run.failed`, `agent_run.blocked` events |
| Top navigation component | Add "Audit Log" link (admin-only) |

---

## 9. Migration

### Prisma migration

```bash
npx prisma migrate dev --name add-audit-log
```

This creates the `AuditLog` table with all indexes. No data migration is needed — the table starts empty and populates as events occur after deployment.

### Rollback

The `AuditLog` table has no foreign keys to any existing table. Removing the feature requires:

1. Remove `recordAudit()` calls from route handlers.
2. Remove the API route and UI page.
3. Drop the `AuditLog` table via a Prisma migration.

No existing functionality is affected by the rollback.

---

## 10. Performance Considerations

### Write path

- `recordAudit()` is fire-and-forget. The Prisma `create()` executes asynchronously after the API response is sent.
- Each write is a single `INSERT` into an indexed table. Expected latency: < 2ms.
- No transactions or locks are held by audit writes.

### Read path

- The `GET /api/audit-log` endpoint uses cursor-based pagination (no `OFFSET`, which degrades with large tables).
- All filter fields are indexed, so filtered queries use index scans.
- Page size is capped at 100 to bound response size.

### Table growth

- At 1,000 events/day: ~365K rows/year, ~55MB including indexes.
- At 10,000 events/day: ~3.65M rows/year, ~550MB.
- PostgreSQL handles both scenarios comfortably without partitioning.
- If growth exceeds expectations, Phase 2 can add time-based partitioning or archival to a cold store.

---

## 11. Testing Strategy

### Unit tests

- `recordAudit()`: verify it creates a record with correct fields; verify it does not throw on DB error (logs instead).
- Metadata truncation: verify long strings are truncated before recording.

### Integration tests (API)

- `GET /api/audit-log` without session returns 401.
- `GET /api/audit-log` with non-admin session returns 403.
- `GET /api/audit-log` with admin session returns 200 and correct shape.
- Filter by `entityType` returns only matching events.
- Filter by `actorUsername` returns only matching events.
- Filter by date range returns only events within range.
- Cursor pagination returns correct pages and terminates.
- Creating a card produces a `card.created` audit event.
- Moving a card produces a `card.moved` audit event with column metadata.

### E2E scenarios

See section 12 — five scenarios added to `docs/features/e2e-testing/SCENARIOS.md`.

---

## 12. E2E Scenarios

The following scenarios are added to `docs/features/e2e-testing/SCENARIOS.md`:

| ID | Scenario | Status |
|----|----------|--------|
| E2E-AUDIT-001 | Navigate to `/audit-log` as admin — table renders with column headers | Planned |
| E2E-AUDIT-002 | `GET /api/audit-log` without session returns 401 | Planned |
| E2E-AUDIT-003 | Create a card — audit log entry appears with action `card.created` | Planned |
| E2E-AUDIT-004 | Filter by `entityType=card` — only card events shown in results | Planned |
| E2E-AUDIT-005 | Non-admin user navigating to `/audit-log` is redirected away | Planned |

---

## 13. Implementation Order

1. **Prisma schema** — add `AuditLog` model, run migration.
2. **`lib/audit.ts`** — implement `recordAudit()` helper and types.
3. **`lib/api-types.ts`** — add `AuditLogEntry` and `AuditLogListResponse`.
4. **`app/api/audit-log/route.ts`** — implement `GET` handler with pagination and filtering.
5. **Card route handlers** — add `recordAudit()` calls to all card mutation routes.
6. **Agent route handlers** — add `recordAudit()` calls.
7. **Environment route handlers** — add `recordAudit()` calls.
8. **Board route handlers** — add `recordAudit()` calls.
9. **RBAC admin route handlers** — add `recordAudit()` calls.
10. **`lib/agent-runner.ts`** — add system event recording.
11. **`app/audit-log/page.tsx`** — implement admin-only page.
12. **`app/audit-log/_components/AuditLogTable.tsx`** — implement table with filter bar.
13. **Top navigation** — add "Audit Log" link (admin-only).
14. **E2E tests** — implement the five scenarios from section 12.

---

## 14. Open Questions

1. **Should metadata store column names or just IDs?** Column names are more readable in the UI but could become stale if a column is renamed. **Recommendation: store both the ID (stable reference) and the name at the time of the event (for display). The name is a snapshot, not a live reference.**

2. **Should system events (`agent_run.*`) be included in the default view or hidden behind a toggle?** They are high-volume and may drown out human actions. **Recommendation: show all events by default, but the entity type filter makes it easy to exclude `agent_run` events. Phase 2 could add a "hide system events" toggle.**

3. **Should the `recordAudit()` helper accept a Prisma transaction client?** In some routes, the mutation runs inside a `$transaction`. If the transaction rolls back, the fire-and-forget audit event would still be written (phantom event). **Recommendation: accept an optional `tx` parameter for use inside transactions, but default to the standalone client. Only use `tx` where correctness matters (e.g., a multi-step mutation that might partially fail).**
