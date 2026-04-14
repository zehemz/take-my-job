# Manual Card Retry — Technical Spec

**Status:** ✅ Shipped  
**Implemented:** 2026-04-13

---

## Problem

When an agent run fails, the card enters a `failed` state and either waits for an automatically-scheduled retry (backoff timer) or sits permanently failed (max attempts exhausted). There was no way for a user to immediately unblock a card without waiting for the timer or manually manipulating the database. This feature adds a one-click escape hatch.

It also surfaced two related bugs that were fixed as part of this work:

- **Off-by-one in retry logic (`lib/orchestrator/retry.ts`):** The guard condition was `run.attempt > MAX_ATTEMPTS` instead of `>=`. With `MAX_ATTEMPTS=5`, agents were running a 6th attempt before the card was marked permanently failed. Fixed to `>=` so attempt 5 is the last attempt that can ever run.
- **Hardcoded `/5` in the UI (`KanbanCard.tsx`, `CardDetailModal.tsx`):** Both components displayed a hardcoded `5` as the denominator in attempt counts (e.g. `2 / 5`). Fixed by adding `maxAttempts: number` to `ApiCard` — populated server-side from the `MAX_ATTEMPTS` environment variable in the API mapper — so the displayed cap always reflects the actual configured value.

---

## What was built

### Two failure states handled

The endpoint handles both scenarios a failed card can be in:

**State A — Scheduled retry pending (`retryAfterMs` is in the future)**

The card has failed but the orchestrator has not yet reached the retry window. The endpoint resets `retryAfterMs` to the current timestamp (effectively "now"), making the card immediately eligible for the next orchestrator dispatch cycle. No new `AgentRun` is created; the existing run record is reused.

**State B — Permanently failed (attempt count ≥ `MAX_ATTEMPTS`)**

All attempts are exhausted. The endpoint creates a brand-new `AgentRun` at `attempt = 1`, resetting the run history so the agent gets a clean start. The card's `agentStatus` transitions back to `pending`.

### API — `POST /api/cards/[id]/retry`

**File:** `app/api/cards/[id]/retry/route.ts`

**Auth:** Calls `auth()` — returns 401 if no valid session.

**Request body:** None.

**Response:** `ApiCard` (HTTP 200) representing the card's updated state after the retry is initiated.

**Error cases:**

| HTTP | Condition |
|------|-----------|
| 401 | No authenticated session |
| 404 | Card not found |
| 400 | Card has no agent runs (nothing to retry) |
| 400 | Card is currently `running` or `evaluating` — retry not permitted while the agent is active |

**No request body is accepted.** All state changes are computed server-side from the current card and run records. The caller cannot specify which attempt to retry or override any parameters.

### API contract types

**File:** `lib/api-types.ts`

- `maxAttempts: number` added to `ApiCard` — the configured maximum attempt count, sourced from the `MAX_ATTEMPTS` env var via the mapper. Used by the UI to display accurate attempt-count denominators (`2 / 5` where `5` comes from this field, not a hardcoded literal).

**File:** `lib/api-mappers.ts`

- DB→API mapping for `ApiCard` now reads `MAX_ATTEMPTS` from `process.env` and includes it as `maxAttempts`. Defaults to `5` if the env var is unset, matching the orchestrator default.

### Relationship to the orchestrator dispatch loop

The orchestrator's `getRetryEligibleRuns` query selects runs where `retryAfterMs <= Date.now()`. State A handling exploits this directly: by setting `retryAfterMs` to now, the card becomes eligible on the next poll without any other change. The orchestrator itself decides when to actually pick it up — this endpoint does not trigger a dispatch, it only removes the time barrier.

For State B, creating a new `AgentRun` at `attempt = 1` causes the card's `agentStatus` to be recalculated as `pending` by the mapper. The orchestrator then treats it as a fresh card on its next cycle.

### UI — "Retry now" button in `CardDetailModal`

**File:** `app/boards/[id]/_components/CardDetailModal.tsx`

The button renders inside the existing `RetrySchedulePanel` conditional block (which already gates on `agentStatus === 'failed'`). It sits immediately below the panel, separated by `mt-3`.

**Trigger:** `POST /api/cards/[id]/retry`

**On success:** Re-fetches `GET /api/cards/[id]` and updates modal state in place. The modal stays open; `AgentStatusBadge` and all status-conditional panels update to reflect the new status (`pending` or `running`).

**On error:** Button returns to default state; an inline error note appears below: `text-xs text-red-400` — `"Could not retry. Try again."` No toast.

**Loading state:** Button label changes to `Retrying…`; button is `opacity-60 pointer-events-none` while the POST is in flight.

Full visual spec is in `docs/features/card-detail/DESIGN.md` § 2h.

---

## What this does not cover

- Retrying a card while `agentStatus` is `running` or `evaluating` — blocked at the API level (400).
- Resetting the attempt counter for a card that has not yet failed (no use case).
- Configuring `MAX_ATTEMPTS` per board or per card — it remains a single global env var.
- Bulk retry across multiple failed cards.
