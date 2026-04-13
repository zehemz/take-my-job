# Kobani — Text Wireframes

> Each wireframe captures a moment in the card lifecycle. A "Behind the scenes" note below each frame describes what the orchestration harness is doing at that instant.

---

## Happy Path

---

### W-01 · User creates a card and fills in acceptance criteria

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  Kobani  /  Sprint 12 Board                               🔔 0   @lucas   ···   ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  ┌─ BACKLOG ──────┐  ┌─ IN PROGRESS ──┐  ┌─ REVIEW ───────┐  ┌─ DONE ────────┐ ║
║  │                │  │                │  │                 │  │               │ ║
║  │  ┌───────────┐ │  │                │  │                 │  │               │ ║
║  │  │ Auth flow │ │  │                │  │                 │  │               │ ║
║  │  │ redesign  │ │  │                │  │                 │  │               │ ║
║  │  │           │ │  │                │  │                 │  │               │ ║
║  │  │ ○ Idle    │ │  │                │  │                 │  │               │ ║
║  │  │ @lucas    │ │  │                │  │                 │  │               │ ║
║  │  └───────────┘ │  │                │  │                 │  │               │ ║
║  │                │  │                │  │                 │  │               │ ║
║  │  + Add card    │  │                │  │                 │  │               │ ║
║  └────────────────┘  └────────────────┘  └─────────────────┘  └───────────────┘ ║
║                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  ┌─ New Card ─────────────────────────────────────────────────────────────┐
  │                                                                        │
  │  Title      Auth flow redesign                                         │
  │                                                                        │
  │  Role       [ Backend Engineer ▾ ]                                     │
  │                                                                        │
  │  GitHub     github.com/acme/api  ·  branch: main                      │
  │                                                                        │
  │  Description                                                           │
  │  ┌──────────────────────────────────────────────────────────────────┐ │
  │  │ Refactor the auth middleware to use JWT refresh tokens.          │ │
  │  │ Remove the legacy session cookie path.                           │ │
  │  └──────────────────────────────────────────────────────────────────┘ │
  │                                                                        │
  │  Acceptance Criteria                                                   │
  │  ┌──────────────────────────────────────────────────────────────────┐ │
  │  │ - [ ] JWT refresh token endpoint is implemented and tested       │ │
  │  │ - [ ] Legacy session cookie code is removed                      │ │
  │  │ - [ ] All existing auth tests pass                               │ │
  │  │ - [ ] No secrets are logged                                      │ │
  │  └──────────────────────────────────────────────────────────────────┘ │
  │                                                                        │
  │                                          [ Cancel ]  [ Create Card ]  │
  └────────────────────────────────────────────────────────────────────────┘
```

**Behind the scenes:** Nothing yet. Card is written to the database with `columnId` pointing to Backlog. No AgentRun is created. Orchestrator poll loop sees the card but skips it — Backlog is not an `isActiveState` column.

---

### W-02 · User drags card to "In Progress" → agent dispatched

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  Kobani  /  Sprint 12 Board                               🔔 0   @lucas   ···   ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  ┌─ BACKLOG ──────┐  ┌─ IN PROGRESS ──┐  ┌─ REVIEW ───────┐  ┌─ DONE ────────┐ ║
║  │                │  │                │  │                 │  │               │ ║
║  │                │  │  ┌───────────┐ │  │                 │  │               │ ║
║  │                │  │  │ Auth flow │ │  │                 │  │               │ ║
║  │                │  │  │ redesign  │ │  │                 │  │               │ ║
║  │                │  │  │           │ │  │                 │  │               │ ║
║  │                │  │  │ ⟳ Running │ │  │                 │  │               │ ║
║  │                │  │  │ @lucas    │ │  │                 │  │               │ ║
║  │  + Add card    │  │  └───────────┘ │  │                 │  │               │ ║
║  └────────────────┘  └────────────────┘  └─────────────────┘  └───────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

**Card detail panel (click to open):**

```
  ┌─ Auth flow redesign  ·  ⟳ Running ──────────────────────────────────┐
  │                                                                       │
  │  Role: Backend Engineer    Attempt: 1 / 5    Started: 2 min ago      │
  │                                                                       │
  │  Acceptance Criteria                                                  │
  │  ◻ JWT refresh token endpoint is implemented and tested              │
  │  ◻ Legacy session cookie code is removed                             │
  │  ◻ All existing auth tests pass                                      │
  │  ◻ No secrets are logged                                             │
  │                                                                       │
  │  Agent Output ─────────────────────────────────────────────────────  │
  │  ┌─────────────────────────────────────────────────────────────────┐ │
  │  │ Reading current auth middleware...                              │ │
  │  │                                                                 │ │
  │  │ Found `src/middleware/auth.ts`. The session cookie is set at    │ │
  │  │ line 42. I'll start by implementing the JWT refresh endpoint    │ │
  │  │ and then remove the cookie path.                                │ │
  │  │                                                                 │ │
  │  │ Creating `POST /auth/refresh`... ▌                              │ │
  │  └─────────────────────────────────────────────────────────────────┘ │
  └───────────────────────────────────────────────────────────────────────┘
```

**Behind the scenes:** The card move fires `POST /api/cards/:id/move`. The API updates `card.columnId` in the database and calls `orchestrator.notify()`. On the next poll tick (≤3s), the orchestrator finds the card in an active column with no running AgentRun, checks that `running.size < MAX_CONCURRENT_AGENTS`, and adds it to the `claimed` set. An AgentRun is created with `status: pending`. The Agent Runner opens an SSE stream to the Anthropic session, then sends the initial prompt rendered from `workflows/backend_engineer.md`. The card's EventSource in the UI starts receiving streamed tokens.

---

### W-03 · Agent completes work → card moves to "Review"

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  Kobani  /  Sprint 12 Board                               🔔 0   @lucas   ···   ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  ┌─ BACKLOG ──────┐  ┌─ IN PROGRESS ──┐  ┌─ REVIEW ───────┐  ┌─ DONE ────────┐ ║
║  │                │  │                │  │                 │  │               │ ║
║  │                │  │                │  │  ┌───────────┐  │  │               │ ║
║  │                │  │                │  │  │ Auth flow │  │  │               │ ║
║  │                │  │                │  │  │ redesign  │  │  │               │ ║
║  │                │  │                │  │  │           │  │  │               │ ║
║  │                │  │                │  │  │ 🔍 Review │  │  │               │ ║
║  │                │  │                │  │  │ @lucas    │  │  │               │ ║
║  │  + Add card    │  │                │  │  └───────────┘  │  │               │ ║
║  └────────────────┘  └────────────────┘  └─────────────────┘  └───────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

**Card detail panel:**

```
  ┌─ Auth flow redesign  ·  🔍 Evaluating ─────────────────────────────────┐
  │                                                                          │
  │  Role: QA Engineer (Evaluator)    Evaluation started: just now          │
  │                                                                          │
  │  Acceptance Criteria                                                     │
  │  ◻ JWT refresh token endpoint is implemented and tested     checking... │
  │  ◻ Legacy session cookie code is removed                    checking... │
  │  ◻ All existing auth tests pass                             checking... │
  │  ◻ No secrets are logged                                    checking... │
  │                                                                          │
  │  Evaluator Output ────────────────────────────────────────────────────  │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ Reviewing work produced by Backend Engineer (Attempt 1)...        │ │
  │  │                                                                    │ │
  │  │ Checking `POST /auth/refresh`... endpoint exists at               │ │
  │  │ `src/routes/auth.ts:88`. Running test suite... ▌                  │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  │  ── Previous work by Backend Engineer ──────────────────────────────    │
  │  [collapsed — click to expand]                                           │
  └──────────────────────────────────────────────────────────────────────────┘
```

**Behind the scenes:** The Backend Engineer agent called `update_card({ status: "completed", next_column: "Review", criteria_results: [...] })`. The Agent Runner validated that all four `criteria_results` entries have `passed: true`. It then updated `AgentRun.status = completed`, moved the card to the Review column, and reported completion to the orchestrator (removing the card from `running` and `claimed`). The orchestrator's next poll tick finds the card now in Review — which is also an `isActiveState` column — and dispatches a new AgentRun with role `qa` (evaluator). A fresh session is created for the evaluation agent, which receives the card description, acceptance criteria, and the prior agent's full output as context.

---

### W-04 · Evaluation passes → awaiting human sign-off

```
  ┌─ Auth flow redesign  ·  ✅ Evaluation Passed ─────────────────────────┐
  │                                                                         │
  │  Evaluated by QA Engineer    Duration: 4 min                           │
  │                                                                         │
  │  Acceptance Criteria                                                    │
  │  ✅ JWT refresh token endpoint is implemented and tested               │
  │     Evidence: `POST /auth/refresh` exists, 3 tests pass (auth.test.ts) │
  │                                                                         │
  │  ✅ Legacy session cookie code is removed                              │
  │     Evidence: No references to `res.cookie('session'...)` found        │
  │                                                                         │
  │  ✅ All existing auth tests pass                                       │
  │     Evidence: `npm test` exit 0, 47 tests passed                       │
  │                                                                         │
  │  ✅ No secrets are logged                                              │
  │     Evidence: No `console.log` near token variables found              │
  │                                                                         │
  │  ─────────────────────────────────────────────────────────────────     │
  │  Human sign-off required before this card moves to Done.               │
  │                                                                         │
  │  [ ✗ Request revision ]                     [ ✓ Approve & close ]     │
  └─────────────────────────────────────────────────────────────────────────┘
```

**Behind the scenes:** The evaluation agent called `update_card({ status: "completed", criteria_results: [...] })` with all criteria passing. The Agent Runner validated results and set `AgentRun.status = completed`. The card is now in a `pendingApproval` state — it will not auto-advance to Done. The orchestrator does not dispatch a new agent for this card. The assignee (`@lucas`) receives a notification: "Evaluation passed on Auth flow redesign — your sign-off is needed."

---

### W-05 · Human approves → card moves to Done

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  Kobani  /  Sprint 12 Board                               🔔 0   @lucas   ···   ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  ┌─ BACKLOG ──────┐  ┌─ IN PROGRESS ──┐  ┌─ REVIEW ───────┐  ┌─ DONE ────────┐ ║
║  │                │  │                │  │                 │  │               │ ║
║  │                │  │                │  │                 │  │  ┌──────────┐ │ ║
║  │                │  │                │  │                 │  │  │Auth flow │ │ ║
║  │                │  │                │  │                 │  │  │redesign  │ │ ║
║  │                │  │                │  │                 │  │  │          │ │ ║
║  │                │  │                │  │                 │  │  │ ✓ Done   │ │ ║
║  │                │  │                │  │                 │  │  │ @lucas   │ │ ║
║  │  + Add card    │  │                │  │                 │  │  └──────────┘ │ ║
║  └────────────────┘  └────────────────┘  └─────────────────┘  └───────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

**Behind the scenes:** User clicked "Approve & close". The API records `approvedBy: @lucas, approvedAt: now` on the card, moves it to the Done column (`isTerminalState: true`). The orchestrator's next tick sees the card in a terminal column — it cancels any open sessions and removes the card from all in-memory tracking. No further dispatch will occur unless the card is manually moved back to an active column.

---

---

## Unhappy Paths

---

### W-06 · Agent gets blocked mid-work

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  Kobani  /  Sprint 12 Board                               🔔 1   @lucas   ···   ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  ┌─ BACKLOG ──────┐  ┌─ IN PROGRESS ──┐  ┌─ REVIEW ───────┐  ┌─ DONE ────────┐ ║
║  │                │  │                │  │                 │  │               │ ║
║  │                │  │  ┌───────────┐ │  │                 │  │               │ ║
║  │                │  │  │ Auth flow │ │  │                 │  │               │ ║
║  │                │  │  │ redesign  │ │  │                 │  │               │ ║
║  │                │  │  │           │ │  │                 │  │               │ ║
║  │                │  │  │ ⚠ Blocked │ │  │                 │  │               │ ║
║  │                │  │  │ @lucas    │ │  │                 │  │               │ ║
║  │  + Add card    │  │  └───────────┘ │  │                 │  │               │ ║
║  └────────────────┘  └────────────────┘  └─────────────────┘  └───────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  🔔 Notification banner (top of screen)
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  ⚠  Agent needs your input on  Auth flow redesign  →  View card             │
  └──────────────────────────────────────────────────────────────────────────────┘
```

**Card detail panel:**

```
  ┌─ Auth flow redesign  ·  ⚠ Blocked  ·  blocked 3 min ago ──────────────┐
  │                                                                         │
  │  ⚠  The agent cannot proceed                                           │
  │  ──────────────────────────────────────────────────────────────────    │
  │  "I found two conflicting migration files:                             │
  │   `20240101_add_refresh_token.sql` and                                 │
  │   `20240115_drop_refresh_token.sql`. I cannot determine which          │
  │   is the intended schema state. Please clarify before I continue."     │
  │                                                                         │
  │  Option A — Reply here ─────────────────────────────────────────────   │
  │  ┌─────────────────────────────────────────────────────────────────┐  │
  │  │ > The Jan 15 migration was a mistake, ignore it. Use Jan 01.    │  │
  │  └─────────────────────────────────────────────────────────────────┘  │
  │  [ Send to agent ]                                                      │
  │                                                                         │
  │  Agent Output (last 5 lines) ───────────────────────────────────────   │
  │  ┌─────────────────────────────────────────────────────────────────┐  │
  │  │ ...reading migrations directory...                              │  │
  │  │ Found conflicting files. Calling update_card(blocked).          │  │
  │  └─────────────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────────────┘
```

**Behind the scenes:** The agent called `update_card({ status: "blocked", blocked_reason: "..." })`. The Agent Runner set `AgentRun.status = blocked` and left the session alive (session remains open on Anthropic's infrastructure). The orchestrator removed the card from `running` but NOT from `claimed` — it will not re-dispatch as long as the run is in `blocked` state. A notification is pushed to `@lucas`. If the user sends a message via the card UI, it is delivered to the live session via `POST /v1/sessions/:id/messages`. The agent's response streams back through the existing SSE connection.

---

### W-07 · Evaluation agent fails criteria → card moves to "Revision Needed"

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  Kobani  /  Sprint 12 Board                        🔔 1   @lucas   ···          ║
╠══════════════════╦══════════════════╦══════════════╦════════════════╦═══════════╣
║  BACKLOG         ║  IN PROGRESS     ║  REVIEW      ║ REVISION NEEDED║  DONE     ║
║                  ║                  ║              ║                ║           ║
║                  ║                  ║              ║  ┌───────────┐ ║           ║
║                  ║                  ║              ║  │ Auth flow │ ║           ║
║                  ║                  ║              ║  │ redesign  │ ║           ║
║                  ║                  ║              ║  │           │ ║           ║
║                  ║                  ║              ║  │ ✗ 2 fail  │ ║           ║
║                  ║                  ║              ║  │ @lucas    │ ║           ║
║  + Add card      ║                  ║              ║  └───────────┘ ║           ║
╚══════════════════╩══════════════════╩══════════════╩════════════════╩═══════════╝

  🔔 Notification banner
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  ✗  Evaluation failed on  Auth flow redesign  ·  2 criteria not met  →  View │
  └──────────────────────────────────────────────────────────────────────────────┘
```

**Card detail panel:**

```
  ┌─ Auth flow redesign  ·  ✗ Evaluation Failed ──────────────────────────┐
  │                                                                         │
  │  Evaluated by QA Engineer    2 of 4 criteria failed                    │
  │                                                                         │
  │  Acceptance Criteria                                                    │
  │  ✅ JWT refresh token endpoint is implemented and tested               │
  │     Evidence: `POST /auth/refresh` exists, tests pass                  │
  │                                                                         │
  │  ✅ Legacy session cookie code is removed                              │
  │     Evidence: No cookie references found                               │
  │                                                                         │
  │  ✗  All existing auth tests pass                                       │
  │     Evidence: `npm test` exit 1 — 3 tests failed in user.test.ts       │
  │               (unrelated auth regression, lines 88, 102, 115)          │
  │                                                                         │
  │  ✗  No secrets are logged                                              │
  │     Evidence: `console.log(token)` found at auth.ts:94                 │
  │                                                                         │
  │  ─────────────────────────────────────────────────────────────────     │
  │  Add context for the agent before sending back (optional)              │
  │  ┌─────────────────────────────────────────────────────────────────┐  │
  │  │ > The user.test.ts regressions are in the session cleanup       │  │
  │  │   tests — those are related, please fix them too.               │  │
  │  └─────────────────────────────────────────────────────────────────┘  │
  │                                                                         │
  │                            [ Send back to In Progress ]                │
  └─────────────────────────────────────────────────────────────────────────┘
```

**Behind the scenes:** The evaluation agent called `update_card({ status: "completed", criteria_results: [...] })` but two entries had `passed: false`. The Agent Runner rejected the completion, moved the card to the "Revision Needed" column (`isRevisionState: true`), and created a new `AgentRun` with `status: failed` on the evaluation run. A notification is pushed to `@lucas`. When the user clicks "Send back to In Progress", the API moves the card to the In Progress column and attaches the user's note plus the full evaluation failure report to the card context. On the orchestrator's next tick, the card is eligible for dispatch again — the new agent prompt includes a `## Previous Evaluation Failure` section with the criteria that failed and the human's clarification note.

---

### W-08 · Agent fails and retries automatically

```
  ┌─ Auth flow redesign  ·  ✗ Failed  ·  retrying in 38s ─────────────────┐
  │                                                                         │
  │  Role: Backend Engineer    Attempt: 2 / 5                              │
  │                                                                         │
  │  ──────────────────────────────────────────────────────────────────    │
  │  Last error                                                             │
  │  "Session terminated unexpectedly after 12 min (stall timeout)"        │
  │                                                                         │
  │  Retry schedule                                                         │
  │  Attempt 1  ✗ Failed    09:14:02                                       │
  │  Attempt 2  ⟳ Pending   09:34:22  (in 38s)                            │
  │                                                                         │
  │  Acceptance Criteria                                                    │
  │  ◻ JWT refresh token endpoint is implemented and tested                │
  │  ◻ Legacy session cookie code is removed                               │
  │  ◻ All existing auth tests pass                                        │
  │  ◻ No secrets are logged                                               │
  │                                                                         │
  │  Agent Output (Attempt 1) ─────────────────────────────────────────    │
  │  ┌─────────────────────────────────────────────────────────────────┐  │
  │  │ Reading auth middleware... installing deps... [session stall]   │  │
  │  └─────────────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────────────┘
```

**Behind the scenes:** The Agent Runner detected a session stall (no events for `MAX_STALL_MS`). It set `AgentRun.status = failed` and reported to the orchestrator. The orchestrator computed the next backoff window (`10s * 2^(attempt-1)` = 20s for attempt 2, shown here as 38s remaining from when the failure was recorded), set `AgentRun.retryAfterMs`, and released the card from `claimed`. On the next tick after `retryAfterMs` elapses, the card is re-evaluated for dispatch eligibility and a new AgentRun (attempt 2) is created with the same configuration.

---

### W-09 · Attention Queue — cross-board blocked card overview

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  Kobani                                                   🔔 3   @lucas   ···   ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  Needs Attention   3 items                                                       ║
║  ─────────────────────────────────────────────────────────────────────────────  ║
║                                                                                  ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  ⚠  BLOCKED  ·  1h 12m ago                                    URGENT    │   ║
║  │                                                                           │   ║
║  │  Auth flow redesign                                                       │   ║
║  │  Sprint 12 Board  /  In Progress                                         │   ║
║  │                                                                           │   ║
║  │  "Conflicting migration files — cannot determine intended schema state"   │   ║
║  │                                                                           │   ║
║  │  Assigned to: @lucas                                         [ Reply ]   │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                  ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  ✗  REVISION NEEDED  ·  22 min ago                                       │   ║
║  │                                                                           │   ║
║  │  Onboarding copy update                                                   │   ║
║  │  Content Pipeline  /  Revision Needed                                    │   ║
║  │                                                                           │   ║
║  │  2 criteria failed: tone mismatch, missing CTA on step 3                 │   ║
║  │                                                                           │   ║
║  │  Assigned to: @lucas                    [ View evaluation report ]       │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                  ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  ⏳ AWAITING SIGN-OFF  ·  5 min ago                                      │   ║
║  │                                                                           │   ║
║  │  API rate limit documentation                                             │   ║
║  │  Platform Docs  /  Review                                                │   ║
║  │                                                                           │   ║
║  │  All 3 criteria passed. Waiting for your approval.                       │   ║
║  │                                                                           │   ║
║  │  Assigned to: @lucas           [ ✗ Request revision ]  [ ✓ Approve ]    │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

**Behind the scenes:** The Attention Queue is a read-only view computed from the database — no orchestrator interaction. It queries all cards across all boards where the current user is either assignee or reviewer, filtered to states: `blocked`, `isRevisionState`, and `pendingApproval`. Cards in `blocked` state for more than 1 hour are flagged as URGENT. Actions in this view (Reply, Approve) are the same API calls as from the board view — the queue is just a different entry point to the same interactions.
