# Approval Workflow — Technical Specification

**Feature:** Approval Workflow
**Status:** 🟠 In Progress
**Authors:** tech-writer

---

## Overview

The approval workflow adds a human-in-the-loop gate between an agent completing
its work and a card reaching `terminal` state. Cards marked `requiresApproval`
must be explicitly approved by a reviewer before they close; cards that are not
flagged are promoted directly to `terminal` by the orchestrator.

---

## 1. DB Schema Changes

### `Card` model — `prisma/schema.prisma`

Add one new field:

```prisma
requiresApproval Boolean @default(false)
```

The field defaults to `false` so that all existing cards are unaffected by the
migration.

A Prisma migration must be generated and applied:

```
npx prisma migrate dev --name add_requires_approval_to_card
```

No other DB changes are required for this feature.

---

## 2. API Changes

### 2.1 `lib/api-types.ts`

**`ApiCard`** — add:

```ts
requiresApproval: boolean;
```

**`CreateCardRequest`** — add:

```ts
requiresApproval?: boolean;
```

No changes are needed to `UpdateCardRequest` or `MoveCardRequest` for this
feature. `ApproveCardRequest` and `RequestRevisionRequest` are new types (see
§2.4 and §2.5).

### 2.2 `lib/api-mappers.ts` — `mapCard()`

Add `requiresApproval: boolean` to the input shape and propagate it to the
returned `ApiCard`:

```ts
requiresApproval: card.requiresApproval,
```

### 2.3 `POST /api/boards/[id]/cards`

Pass `requiresApproval` from the validated request body to the Prisma `create`
call:

```ts
data: {
  ...existingFields,
  requiresApproval: body.requiresApproval ?? false,
}
```

### 2.4 New: `POST /api/cards/[id]/approve`

**Purpose:** Reviewer approves the card. Moves it to the board's `terminal`
column and records who approved it.

**Auth:** `auth()` guard required; returns `401` if no session.

**Request body:** none (all attribution is server-side).

**Server-side logic:**

1. Call `auth()` and extract the reviewer's identity from the session.
2. Fetch the card; if not found return `404`.
3. Verify the card is currently in a `review` column; if not return
   `400 { "error": "Card is not in a review column" }`.
4. Resolve the board's `terminal` column (first column with
   `columnType = 'terminal'`); if none exists return `409`.
5. Update the card:
   ```ts
   data: {
     columnId: terminalColumn.id,
     approvedBy: session.user.email,   // NEVER from request body
     approvedAt: new Date(),
     movedToColumnAt: new Date(),
   }
   ```
6. Return the updated `ApiCard`.

**`approvedBy` must always be set from the server session.** The field must
never be accepted from the request body.

### 2.5 New: `POST /api/cards/[id]/request-revision`

**Purpose:** Reviewer sends the card back for revision. Moves it to the board's
`revision` column and stores the reviewer's note.

**Auth:** `auth()` guard required; returns `401` if no session.

**Request body:**

```ts
interface RequestRevisionRequest {
  reason: string;
}
```

**Server-side logic:**

1. Call `auth()` and verify session; return `401` if absent.
2. Fetch the card; return `404` if not found.
3. Verify the card is currently in a `review` column; return
   `400 { "error": "Card is not in a review column" }` otherwise.
4. Resolve the board's `revision` column; return `409` if none exists.
5. Validate `reason` is a non-empty string; return `400` if invalid.
6. Update the card:
   ```ts
   data: {
     columnId: revisionColumn.id,
     revisionContextNote: body.reason,
     movedToColumnAt: new Date(),
   }
   ```
7. Return the updated `ApiCard`.

### 2.6 `PATCH /api/cards/[id]/move` — transition validation

The existing move route (`POST /api/cards/[id]/move/route.ts`) currently
performs no column-type validation. Add a server-side guard that checks the
source column type and target column type against the valid transition matrix
before applying the update.

**Transition matrix:**

| Source `columnType` | Allowed targets | Rejected targets |
|---------------------|-----------------|-----------------|
| `inactive` | `active` | all others |
| `active` | `active` (reorder), `review`, `revision` | `terminal`, `inactive` |
| `review` | `terminal`, `revision` | `active`, `inactive` |
| `revision` | `active` | `terminal`, `review`, `inactive` |
| `terminal` | — (none) | all |

When the transition is invalid, return:

```
400 { "error": "Invalid column transition: <fromType> → <toType>" }
```

The source column is resolved by looking up the card's current `columnId` before
applying the update.

---

## 3. `mapAgentRunStatus` Fix

### Current behaviour

`mapAgentRunStatus(status, criteriaResults)` maps `completed` to either
`'completed'` or `'evaluation-failed'` depending on whether all criteria passed.

### Problem

`'pending-approval'` is a valid `AgentStatus` in the frontend union but is never
produced. No DB path sets it. The current signature has no access to column
context, so it cannot distinguish "agent succeeded, card is in review awaiting a
human" from "agent succeeded, card is already approved".

### Required change

`mapAgentRunStatus` needs access to the card's current column type. There are
two acceptable approaches:

**Option A — Pass column type as a parameter (preferred):**

```ts
export function mapAgentRunStatus(
  status: AgentRunStatus,
  criteriaResults: string | null,
  columnType?: ColumnType,   // new, optional for backwards compat
): AgentStatus
```

When `status === 'completed'`, all criteria pass, **and** `columnType === 'review'`,
return `'pending-approval'` instead of `'completed'`.

**Option B — Post-hoc override in `mapCard()`:**

After calling `deriveCardAgentStatus`, check the card's column type and
override the status:

```ts
if (agentStatus === 'completed' && card.columnType === 'review') {
  agentStatus = 'pending-approval';
}
```

Option A is preferred because it keeps the mapping logic centralised. Option B
is an acceptable short-term shim if the mapper signature cannot be changed
without wider refactoring.

Both `mapCard()` and `deriveCardAgentStatus()` must be updated to thread column
type through, since they currently call `mapAgentRunStatus` internally.

---

## 4. Orchestrator Changes (`lib/orchestrator/`)

### Location

The relevant hook is in `lib/orchestrator/reconcile.ts` inside
`reconcileRunning()`. The relevant moment is when `session.status === 'terminated'`
and `session.outcome === 'success'`:

```ts
if (session.status === 'terminated') {
  if (session.outcome === 'success') {
    await deps.db.updateAgentRunStatus(run.id, AgentRunStatus.completed)
    // ← NEW LOGIC HERE
    state.running.delete(cardId)
    state.claimed.delete(cardId)
  } else { ... }
}
```

### New routing logic

After marking the run `completed`, fetch `card.requiresApproval` and route
accordingly:

```
if (card.requiresApproval) {
  move card to the board's review column
} else {
  move card to the board's terminal column
}
```

The move should be performed via the same `PATCH /api/cards/[id]/move`
endpoint (or an equivalent direct DB call using `deps.db`) so that transition
validation and `movedToColumnAt` bookkeeping are applied consistently.

The orchestrator should not call the HTTP endpoint internally; it should use
`deps.db` directly to avoid a loopback HTTP call.

---

## 5. Store Changes (`lib/store.ts`)

### 5.1 `approveCard`

**Current (broken):** mutates Zustand state in-place, hardcodes
`approvedBy: '@lucas'`, makes no API call.

**Target behaviour:**

1. `POST /api/cards/:id/approve` (no body).
2. On success, call `fetchBoard(boardId)` to re-sync all board state from the
   server.
3. On failure, surface an error (do not mutate local state).

The `approvedBy` field must never be written by the client. It is set
server-side from the session.

### 5.2 `requestRevision`

**Current (broken):** mutates Zustand state in-place, makes no API call.

**Target behaviour:**

1. `POST /api/cards/:id/request-revision` with body `{ reason }`.
2. On success, call `fetchBoard(boardId)` to re-sync all board state.
3. On failure, surface an error.

### 5.3 `createCardApi`

Add `requiresApproval?: boolean` to the payload parameter and include it in the
request body sent to `POST /api/boards/[id]/cards`.

---

## 6. UI Changes

### 6.1 `NewCardModal`

- Add a `requiresApproval` checkbox (default: unchecked, matching the DB
  default of `false`).
- Include `requiresApproval` in the payload passed to `createCardApi`.

### 6.2 `KanbanBoard` — drag-and-drop

Today drag-and-drop is unrestricted. After this change, valid drop targets must
be computed from the source card's column type using the transition matrix in
§2.6.

Implementation approach:

- When a drag starts, resolve the source card's column type.
- During the drag, visually suppress (grey out or hide the drop indicator on)
  column targets that are invalid for the source column type.
- On drop, `moveCardApi` calls the server. If the server returns `400`, revert
  the optimistic local state update (if any) and show a toast or inline error.

Because the API enforces the transition rule, the UI suppression is a UX
improvement only — it is not the authoritative enforcement layer.

### 6.3 `CardDetailModal` — `PendingApprovalActions`

`PendingApprovalActions` currently renders approve and request-revision buttons.
These must call the real store actions (`approveCard`, `requestRevision`) which,
after this change, will call real API endpoints rather than mutating local state.

No structural change to `PendingApprovalActions` itself is required, only
ensuring the store actions underneath are wired to the API.

---

## 7. E2E Scenarios to Add to `SCENARIOS.md`

The following scenarios should be added to the E2E test file with status
`🟡 Planned`:

| ID | Scenario | Expected outcome |
|----|----------|-----------------|
| APPROVAL-001 | `POST /api/cards/:id/approve` without a session | `401 Unauthorized` |
| APPROVAL-002 | `POST /api/cards/:id/approve` on a card not in a `review` column | `400 Bad Request` |
| APPROVAL-003 | `POST /api/cards/:id/request-revision` without a session | `401 Unauthorized` |
| APPROVAL-004 | Drag card from `active` to `terminal` column | Card remains in `active`; API returns `400 Invalid column transition` |
| APPROVAL-005 | Create card with `requiresApproval: true`, fetch board, verify field is `true` on returned card | Field persists through create → fetch cycle |

---

## 8. Known Gaps (Current Broken State — Not In Scope to Fix Here)

These are documented for accuracy and must be resolved during implementation:

- `approveCard` in `lib/store.ts` only mutates Zustand state; it hardcodes
  `approvedBy: '@lucas'`; it makes no API call.
- `requestRevision` in `lib/store.ts` only mutates Zustand state; it makes no
  API call.
- `'pending-approval'` `AgentStatus` is never produced by `mapAgentRunStatus`
  because `mapAgentRunStatus` has no column-type context.
- Drag-and-drop in `KanbanBoard` is unrestricted; any card can be dropped onto
  any column with no server-side validation rejecting the move.
