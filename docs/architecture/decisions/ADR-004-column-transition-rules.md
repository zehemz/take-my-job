# ADR-004 — Column transition rules

**Date:** 2026-04-13
**Status:** Accepted
**Deciders:** product-pm, backend-dev, frontend-dev

---

## Context

Kobani columns carry a `ColumnType` that encodes a card's position in the agent
lifecycle:

```
inactive → active → review → (revision →) active → review → terminal
```

Until this ADR, drag-and-drop moves are unrestricted. A user (or a direct API
caller) can move any card to any column regardless of column type. This causes
two categories of harm:

1. **Orchestrator state corruption.** The orchestrator makes hard assumptions
   about the column a card is in. For example, it interprets a card entering
   `active` as a signal to start an agent run, and a card entering `terminal` as
   a signal that the lifecycle is complete. Moving a card from `review` directly
   back to `active` without going through `revision` leaves the orchestrator in
   an undefined state: it may restart an agent run that was not intended, or it
   may skip the revision step entirely, losing the reviewer's feedback.

2. **Audit trail gaps.** The column sequence is the audit log. A card that jumps
   from `active` to `terminal` without passing through `review` (when
   `requiresApproval` is true) has no record of human approval. A card that
   moves from `terminal` to `revision` retroactively invalidates a completed
   audit record.

These failure modes are silent: the UI does not warn, the API does not reject,
and the resulting state is indistinguishable from a valid state to most
observers.

---

## Decision

Enforce a strict column transition matrix at both the UI and API layers.

### Valid transition matrix

| Source `columnType` | Allowed targets |
|---------------------|-----------------|
| `inactive` | `active` |
| `active` | `review`, `revision` |
| `review` | `terminal`, `revision` |
| `revision` | `active` |
| `terminal` | *(none — terminal is final)* |

All transitions not listed above are **invalid**.

Notable rejections:

- `active → terminal`: agents cannot self-approve; human review is required when
  `requiresApproval` is set, and the orchestrator handles the direct path when
  it is not.
- `review → active`: once submitted for review, a card cannot be pulled back to
  active without a revision decision.
- `revision → terminal`: a revision must pass through `active` and `review`
  again; skipping that cycle bypasses quality control.
- `terminal → *`: the terminal state is final. Reopening a closed card requires
  creating a new card.

Reordering cards within the same column is always permitted and is not subject
to transition validation.

### Enforcement layers

**1. UI — visual suppression**

During a drag operation, the UI resolves the source card's column type and marks
columns that are invalid targets as non-droppable (greyed out or with a
suppressed drop indicator). This gives immediate visual feedback and prevents
accidental misdrops.

The UI suppression is a courtesy layer only. It does not replace server-side
validation.

**2. API — 400 rejection**

`POST /api/cards/[id]/move` resolves both the source column type (from the
card's current `columnId`) and the target column type (from the request body
`columnId`) before applying any update. If the transition is invalid, the
endpoint returns:

```
HTTP 400 Bad Request
{ "error": "Invalid column transition: <fromType> → <toType>" }
```

The card is not moved. This guard fires regardless of how the request was made
— browser drag, direct API call, or automated script — making the invariant
unconditional.

---

## Consequences

- **Positive — orchestrator integrity:** The orchestrator can trust that cards
  only arrive in a given column via a valid transition. Defensive checks for
  "impossible" states can be removed or simplified.
- **Positive — audit trail completeness:** Every card that reaches `terminal`
  has a provable path through `review` (or through the orchestrator's direct
  promotion path for non-approval cards). The column history is a trustworthy
  audit log.
- **Positive — defence in depth:** Both layers enforce the rule independently.
  A misbehaving client or a curl command cannot corrupt board state.
- **Negative — constrained UX:** Users cannot manually shortcut the workflow.
  Moving a card from `review` back to `active` (e.g. to add acceptance criteria
  after the fact) is no longer possible without going through `revision` first.
  This is the intended behaviour; if it causes friction, the correct response is
  to improve the card-editing workflow rather than relax the transition rules.
- **Escape hatch:** In a genuine emergency where a card must be moved outside
  the valid matrix (e.g., correcting a data entry error), an administrator with
  direct database access can update the `columnId` field directly. This is
  intentionally out-of-band and leaves an implicit audit marker (the
  `movedToColumnAt` timestamp will not be set via the normal path).

---

## Revisit when

- A deliberate "fast-path" promotion is introduced (e.g. cards created by an
  admin that skip `review`). In that case, introduce a privileged internal
  endpoint rather than relaxing the public API rule.
- The column type model changes to support more than five types — the transition
  matrix must be updated in lockstep.
