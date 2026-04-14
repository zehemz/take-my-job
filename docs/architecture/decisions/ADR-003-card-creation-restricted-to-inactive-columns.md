# ADR-003 — Card creation restricted to `inactive` columns

**Date:** 2026-04-13
**Status:** Accepted
**Deciders:** product-pm, frontend-dev, backend-dev

---

## Context

Kobani columns carry a `ColumnType` that determines where they sit in the agent
workflow:

```
inactive → active → review → (revision →) terminal
```

Each `ColumnType` implies a specific state for the cards it contains:

| ColumnType | Meaning |
|------------|---------|
| `inactive` | Backlog / entry point — card has not been picked up by an agent |
| `active` | An agent is actively working on the card |
| `review` | Work is submitted; a reviewer is evaluating the output |
| `revision` | Reviewer requested changes; agent must revise |
| `terminal` | Card lifecycle is complete (approved or rejected) |

Agents and orchestration logic make hard assumptions about this lifecycle.
A card entering `active`, `review`, `revision`, or `terminal` is expected to
have passed through all prior stages: it should have an agent assigned, run
history, approval state, and other fields that are only populated as the card
moves through the flow.

If a card can be created directly in a non-`inactive` column, several invariants
break:

1. **Agent workflow assumptions** — The orchestrator assumes any card in
   `active` already has an agent run in progress. A freshly created card there
   would have no run, causing the orchestrator to enter an undefined state.
2. **Missing required state** — Fields such as `approvedBy`, acceptance-criteria
   results, and agent status badges are populated incrementally as a card moves
   through columns. Creating mid-flow skips those writes entirely, leaving the
   card in a structurally incomplete state.
3. **Audit trail gaps** — The lifecycle is also an audit log. A card that starts
   in `review` has no record of who worked on it or what output was produced.

---

## Decision

Cards may only be created in columns whose `ColumnType` is `inactive`.

This rule is enforced at two layers:

1. **UI** — The "+ New Card" button is rendered only on columns with
   `columnType === 'inactive'`. Columns of any other type do not show the
   button, making the restriction visible without a disruptive error message.
2. **API** — `POST /api/boards/[id]/cards` resolves the target column and checks
   its `columnType`. If it is not `inactive`, the server returns `400 Bad
   Request` with a descriptive error message. This prevents bypassing the UI
   restriction via direct API calls.

---

## Consequences

- **Positive — simpler agent orchestration:** The orchestrator can assume that
  any card entering `active` came from `inactive` and therefore has a clean,
  well-defined starting state. No defensive checks are needed for "partially
  initialised" cards.
- **Positive — consistent audit trail:** Every card has a full lifecycle record
  from the moment it is first touched by an agent.
- **Positive — defensive depth:** Both the UI and API enforce the rule
  independently, so a misconfigured client or a direct API caller cannot
  accidentally corrupt board state.
- **Negative — slight UX restriction:** Users cannot shortcut by creating a card
  directly in an `active` or `review` column. They must create in an `inactive`
  column and then drag the card to the desired position. This is the intended
  workflow; the restriction is by design.

---

## Revisit when

- A deliberate "fast-track" workflow is introduced where a card should skip
  `inactive` (e.g. emergency hotfix cards). If that happens, introduce a
  separate creation endpoint or a server-side flag rather than relaxing this
  rule globally.
- Bulk import tools need to seed cards at arbitrary stages — those should use a
  privileged internal API, not the public card-creation endpoint.
