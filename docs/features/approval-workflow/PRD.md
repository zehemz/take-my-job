# PRD: Approval Workflow

**Product:** Kobani  
**Feature:** Card Approval Workflow & Restricted Column Transitions  
**Status:** Draft  
**Author:** Lucas Bais  
**Date:** 2026-04-13

---

## 1. Problem Statement

Two gaps in the current implementation undermine the integrity of Kobani's agent-driven workflow.

### 1.1 Store-only approval with hardcoded identity

`approveCard` and `requestRevision` in `lib/store.ts` mutate only local Zustand state and write `approvedBy: '@lucas'` unconditionally. Nothing is persisted to the database, and the approver identity is a compile-time constant, not the authenticated session user. The consequences are:

- **No audit trail.** Approval decisions vanish on page refresh. There is no record in the database of who approved a card, when, or under what conditions.
- **Fabricated identity.** `approvedBy` must come from the server-side session, as documented in `CLAUDE.md` and the auth PRD (§4.7). Allowing the client to write this field — let alone hardcoding it — violates the security model already established for `triggeredBy` on `AgentRun`.
- **Orchestrator cannot trust card state.** The orchestrator reads card status from the database to decide whether to dispatch an agent run. If approval actions never reach the DB, the orchestrator operates on stale data and may re-dispatch agents against cards that a human has already reviewed and rejected.

### 1.2 Unrestricted drag-and-drop transitions

Cards can currently be dragged to any column from any column. The orchestrator, however, makes hard assumptions about the validity of the column a card is in. Moving a card directly from `inactive` to `terminal`, or from `terminal` back to `active`, produces states the orchestrator was not designed to handle:

- **Premature terminal.** Dragging directly to `terminal` skips evaluation and approval entirely, silently marking work "done" with no agent run or acceptance-criteria check.
- **Resurrection from terminal.** Moving a completed card back into an active column re-triggers an agent run against a card that may have already merged code or made external changes.
- **Review bypass.** Dragging from `active` directly to `terminal` is only safe when `requiresApproval: false` — but that gate is only supposed to be enforced by the orchestrator. Human drag-and-drop should not be able to replicate the orchestrator's auto-complete path, because it skips acceptance-criteria validation.

Allowing arbitrary transitions produces orphaned orchestrator state, contradicts the approval intent set at card creation, and creates audit gaps that cannot be reconstructed after the fact.

---

## 2. Goals

- **Persist approval actions to the database.** `approveCard` and `requestRevision` must call real API endpoints that write to `Card` (and optionally `AgentRun`) in the database before any state update is reflected in the UI.
- **Set `approvedBy` server-side from the authenticated session.** The client never supplies this value. The API handler reads `session.user.githubUsername` and writes it alongside an `approvedAt` timestamp.
- **Enforce the column transition matrix.** Drag-and-drop is restricted to the set of valid transitions. Invalid drop targets are visually suppressed at drag start so users receive immediate, clear feedback rather than a silent rejection.
- **Honor `requiresApproval` at agent completion.** When the orchestrator finishes a card with all criteria passing, `requiresApproval: true` routes the card to `review` (status `pending-approval`); `requiresApproval: false` routes it directly to `terminal`. This logic currently lives in the orchestrator but depends on the `requiresApproval` flag being set correctly on the card record in the database.
- **Keep the orchestrator as the sole path to `terminal` for cards that require approval.** Humans may approve (moving `review → terminal`) or reject (moving `review → revision`), but no drag-and-drop shortcut bypasses the review step.

---

## 3. Non-Goals

- **Multi-approver workflows.** A single approver action is sufficient in v1. There is no quorum, sequential sign-off chain, or delegated approval.
- **Approval history beyond `approvedBy` / `approvedAt`.** A full audit log table (who rejected, how many rounds of revision, etc.) is explicitly deferred. The `Card` record stores only the most recent approval attribution.
- **Approval notifications or email.** Reviewers discover cards needing attention via the existing Attention Queue. Push notifications or email digest are out of scope.
- **Approval reassignment.** Cards cannot be reassigned to a different reviewer. Any whitelisted user may approve any card.
- **Approval on cards with `requiresApproval: false`.** Cards flagged as not requiring approval move directly to `terminal` on orchestrator completion. There is no UI to manually route such a card through review in v1.
- **Changing `requiresApproval` after card creation.** The flag is set once at creation. Toggling it post-hoc would require reasoning about in-flight agent runs and is deferred.
- **Rejection reasons stored long-term.** The revision reason passed to `requestRevision` is surfaced to the agent in the next run's context but is not stored as a standalone `RevisionRound` record in v1.

---

## 4. User Stories

### 4.1 Card creator — setting approval intent at creation time

> As a card creator, I want to mark a card as requiring human approval so that an agent completing the task does not automatically close it without a review step.

Acceptance criteria:
- The card creation form includes a "Require approval" checkbox, defaulting to `true`.
- The value is persisted as `requiresApproval` on the `Card` record in the database.
- After creation, the flag is visible in the Card Detail view and is immutable.

### 4.2 Reviewer — approving a card in `review`

> As a reviewer, I want to approve a card that the agent has completed so that it moves to `terminal` and is marked done, with my identity recorded as the approver.

Acceptance criteria:
- Cards in the `review` column with `agentStatus: pending-approval` display an "Approve" action in the Card Detail modal and the Attention Queue.
- Clicking "Approve" calls `POST /api/cards/:id/approve`, which sets `card.status = terminal`, `card.approvedBy = session.user.githubUsername`, and `card.approvedAt = now()` in the database, then moves the card to the `terminal` column.
- The action is reflected in the UI without requiring a page refresh (optimistic update, confirmed via API response).
- If the API call fails, the optimistic update is rolled back and an error is surfaced to the reviewer.
- `approvedBy` matches the GitHub username of the signed-in user, not a hardcoded or client-supplied value.

### 4.3 Reviewer — requesting a revision

> As a reviewer, I want to send a card back for revision with a reason so that the agent knows what to fix in the next run.

Acceptance criteria:
- Cards in the `review` column with `agentStatus: pending-approval` display a "Request revision" action alongside "Approve".
- Clicking it opens a text input for the revision reason (required, non-empty).
- Submitting calls `POST /api/cards/:id/request-revision` with `{ reason: string }`. The handler moves the card to the `revision` column and passes the reason to the next agent run context.
- `approvedBy` and `approvedAt` are cleared (set to `null`) on the card when a revision is requested, since the previous approval state (if any) no longer applies.
- The action is reflected in the UI optimistically and rolled back on API failure.

### 4.4 Reviewer — drag-and-drop within valid transitions

> As a reviewer, I want to move cards manually between columns when valid, and have invalid targets visually suppressed so I cannot accidentally corrupt card state.

Acceptance criteria:
- When a user begins dragging a card, all columns that are not valid drop targets for that card's current column are visually dimmed or marked as non-droppable.
- Dropping on a valid target calls `POST /api/cards/:id/move` as today, but the server validates the transition and rejects invalid moves with `400 Bad Request` and a human-readable error message.
- Dropping on an invalid target is blocked client-side before a request is made; no API call is issued.
- The transition matrix in section 6 is the authoritative source of truth for both client-side suppression and server-side validation.

### 4.5 Orchestrator — auto-routing on agent completion

> As the orchestrator, I need the `requiresApproval` flag to be reliable in the database so I can correctly route a completed card to `review` or `terminal` without reading application state from the UI layer.

Acceptance criteria:
- When an agent run completes with all acceptance criteria passing, the orchestrator reads `card.requiresApproval` from the database.
- `requiresApproval: true` → card is moved to the `review` column, `agentStatus` set to `pending-approval`.
- `requiresApproval: false` → card is moved to the `terminal` column, `agentStatus` set to `completed`.
- The orchestrator does not rely on Zustand state or any client-side representation. Its reads and writes go directly to the database via `lib/db-queries.ts`.

---

## 5. Functional Requirements

### 5.1 New API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/cards/:id/approve` | Required | Approve a `review`-column card; moves it to `terminal` |
| `POST` | `/api/cards/:id/request-revision` | Required | Request revision; moves card to `revision` column |

Both endpoints:
- Call `auth()` as a secondary guard and return `401` if no valid session is present.
- Read `approvedBy` exclusively from `session.user.githubUsername` — any `approvedBy` in the request body is ignored entirely.
- Return the updated card as a `CardResponse` (using the existing `lib/api-types.ts` shape) on success.
- Return `409 Conflict` if the card is not in a state that allows the action (e.g. `approve` called on a card not in `review`).

### 5.2 Server-side Transition Validation

`POST /api/cards/:id/move` must validate the `(fromColumn, toColumn)` pair against the transition matrix before persisting or dispatching an orchestrator action. Invalid transitions must return `400 Bad Request` with body:

```json
{ "error": "Invalid column transition", "from": "<fromColumn>", "to": "<toColumn>" }
```

The transition matrix is defined in code as a typed constant (e.g. `VALID_TRANSITIONS` in `lib/kanban-types.ts`) shared between the server validation logic and the client-side drag suppression logic. A single source of truth prevents drift.

### 5.3 Client-side Drag Suppression

`KanbanBoard.tsx` must compute the set of valid target columns at `dragstart` using the same `VALID_TRANSITIONS` constant. Columns not in the valid set must receive a visual treatment (e.g. reduced opacity, a "no-drop" cursor) during the drag. The `onDrop` handler must also guard against invalid targets as a belt-and-suspenders check before calling `moveCardApi`.

### 5.4 `requiresApproval` Persistence

The `Card` Prisma model must include a `requiresApproval Boolean @default(true)` field. The card creation API (`POST /api/boards/:id/cards`) must accept and persist this field. It must not be updatable via `PATCH /api/cards/:id` after creation.

### 5.5 Zustand Store Updates

`approveCard` and `requestRevision` in `lib/store.ts` must be refactored to:
1. Issue the appropriate API call first.
2. Update local state only on a successful response, using the server-returned card data.
3. Roll back to the pre-action state if the API call returns an error.

The hardcoded `approvedBy: '@lucas'` must be removed. The store's local `Card` representation should reflect `approvedBy` from the API response, not set it directly.

---

## 6. Column Transition Matrix

The following matrix is the single source of truth for allowed drag-and-drop moves. It applies to both client-side drag suppression and server-side validation in `POST /api/cards/:id/move`.

| From \ To | `inactive` | `active` | `review` | `revision` | `terminal` |
|-----------|-----------|---------|--------|----------|---------|
| `inactive` | — | ✅ | ❌ | ❌ | ❌ |
| `active` | ❌ | — | ✅ | ✅ | ❌ |
| `review` | ❌ | ❌ | — | ✅ | ✅ |
| `revision` | ❌ | ✅ | ❌ | — | ❌ |
| `terminal` | ❌ | ❌ | ❌ | ❌ | — |

Notes:
- `active → terminal` is intentionally blocked for human drag-and-drop. The only path to `terminal` for a card with `requiresApproval: true` is `review → terminal` via the approve action. For `requiresApproval: false`, the orchestrator handles the move programmatically and is not subject to the drag-and-drop matrix.
- `terminal → *` is entirely locked. Terminal is a final state.
- `revision → review` is blocked; revision always goes back through the agent (`revision → active`) before re-entering review.

---

## 7. Acceptance Criteria

The feature is complete when all of the following are true:

1. **Approval persists.** Clicking "Approve" on a `review`-column card writes `approvedBy` (session username), `approvedAt` (server timestamp), and column `terminal` to the database. Refreshing the page reflects the persisted state.

2. **Revision persists.** Clicking "Request revision" writes the revision reason to the card context and moves the card to `revision` in the database. `approvedBy` and `approvedAt` are nulled out.

3. **`approvedBy` is session-sourced.** No code path allows a client-supplied `approvedBy` value to reach the database. A test sending `{ "approvedBy": "evil-user" }` in the request body of `/api/cards/:id/approve` must result in `approvedBy` being set to the authenticated session user, not `"evil-user"`.

4. **Hardcoded identity is gone.** The string `'@lucas'` does not appear in any approval-related code path.

5. **Invalid drags are suppressed.** Dragging a card from `terminal` renders all other columns non-droppable. Dragging from `inactive` renders only `active` as a valid target. The `VALID_TRANSITIONS` constant drives both the UI suppression and the server guard.

6. **Server rejects invalid transitions.** `POST /api/cards/:id/move` with an invalid `(from, to)` pair returns `400` with the error body specified in §5.2. A valid session is required; unauthenticated calls return `401`.

7. **`requiresApproval` is stored.** The `Card` table has the `requiresApproval` column. Creating a card with `requiresApproval: false` and completing the agent run routes the card directly to `terminal`. Creating one with `requiresApproval: true` routes it to `review` with `agentStatus: pending-approval`.

8. **Optimistic rollback works.** Simulating an API failure on approve or request-revision causes the card to revert to its pre-action column and status in the UI without a page refresh.

9. **Attention Queue reflects reality.** Cards shown in the Attention Queue as `pending-approval` are in the `review` column in the database. After approval, they disappear from the queue.

10. **No regression in existing move flow.** Valid drag-and-drop transitions (`inactive → active`, `review → revision`, etc.) continue to work exactly as before.

---

## 8. Open Questions

1. **`inactive → active` with no orchestrator readiness signal.** When a user drags a card from `inactive` to `active`, the orchestrator picks it up on its next polling cycle and dispatches an agent run. There is currently no handshake confirming the orchestrator is ready before the move is committed. Should the move endpoint return immediately (fire-and-forget dispatch) as it does today, or should it wait for the orchestrator to acknowledge the dispatch? A failed dispatch currently leaves the card in `active` with `agentStatus: idle`, which is confusing. This needs a decision before implementation.

2. **Approval endpoint vs. extending `PATCH /api/cards/:id`.** The design above proposes dedicated `POST /api/cards/:id/approve` and `POST /api/cards/:id/request-revision` endpoints. An alternative is to extend the existing `PATCH` endpoint with an `action` field. Dedicated endpoints are more explicit and easier to audit separately, but add surface area. Should the team standardize on one approach?

3. **`requiresApproval: false` and the drag matrix.** For cards with `requiresApproval: false` that the orchestrator has completed and placed in `terminal`, the transition matrix already locks them there. But what if a human manually drags a `requiresApproval: false` card from `active` to `review`? The matrix permits `active → review`, but putting a no-approval card in `review` creates an awkward state. Should the server enforce that `active → review` is only valid for `requiresApproval: true` cards, or is human escalation (e.g. agent blocked, human takes over) sufficient justification to allow it regardless?

4. **Revision reason storage.** Currently the revision reason is passed through to the next agent run's context but is not stored as a first-class field on `Card` or a separate `RevisionRound` record. If the agent run fails or the card is re-routed, the reason is lost. Should `Card` have a `lastRevisionReason` text field for v1, or is it acceptable for this to live only in the run context?

5. **Who can approve?** The current design allows any authenticated, whitelisted user to approve any card — including the card creator. Should self-approval be disallowed? This would require storing `createdBy` on `Card` and adding a check in the approve handler.

6. **Concurrent approval.** If two reviewers both have the same `review`-column card open and one approves it, the second reviewer's UI will be stale until the next SSE event. The approve endpoint should return `409` if the card is no longer in `review` at the time of the request. Is SSE delivery guaranteed to arrive fast enough that this race is purely theoretical, or does the UI need an explicit staleness warning?

7. **`requiresApproval` migration.** The `requiresApproval` column does not yet exist in the Prisma schema. The migration must set a sensible default (`true`) so existing cards are not silently auto-completed by the orchestrator after the migration runs. Confirm the default before writing the migration.
