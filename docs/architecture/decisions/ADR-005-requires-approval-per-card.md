# ADR-005 — Per-card `requiresApproval` flag

**Date:** 2026-04-13
**Status:** Accepted
**Deciders:** product-pm, backend-dev, frontend-dev

---

## Context

Kobani's orchestrator promotes a card to `terminal` when an agent run completes
successfully. The question is whether a human reviewer must explicitly approve
this promotion, and if so, how that requirement is expressed in the data model.

Three options were considered:

**Option A — Per-card boolean flag (`requiresApproval: Boolean`).**
Each card carries its own flag, set at creation time. The orchestrator checks
the flag at run-completion time and routes to `review` or `terminal`
accordingly.

**Option B — Always require approval.**
Every card must pass through `review` before reaching `terminal`. No flag
needed; the rule is structural.

**Option C — Column-configured approval.**
A boolean is added to the `Column` model (e.g. `requiresApproval: Boolean`).
All cards in a given column inherit the approval requirement when they move
through it.

| Concern | Option A (per-card) | Option B (always) | Option C (per-column) |
|---------|--------------------|--------------------|----------------------|
| Flexibility | High — card-by-card control | None — one-size-fits-all | Medium — column-level buckets |
| Default safety | Configurable (checked or unchecked) | Maximum (always) | Depends on column setup |
| DB change | One field on `Card` | None | One field on `Column` |
| API surface | Field flows through create/fetch | No change | Column config endpoint needed |
| Orchestrator complexity | Low — one flag check | Lowest | Medium — resolve column flag at runtime |
| Risk of misconfiguration | Low | None | Medium — wrong column config silently skips review |

---

## Decision

Use **Option A — per-card `requiresApproval` boolean flag** on the `Card`
model, defaulting to `false`.

```prisma
requiresApproval Boolean @default(false)
```

The orchestrator checks this flag immediately after a run completes
successfully:

- `requiresApproval = true` → move card to the board's `review` column.
- `requiresApproval = false` → move card directly to the board's `terminal`
  column.

---

## Reasoning

**Option B (always require)** was rejected because it imposes review overhead on
automated or low-stakes cards where human approval adds no value. Kobani is
designed to handle a mix of card types; a blanket requirement would slow down
the majority of work to protect a minority of cases.

**Option C (column-configured)** was rejected because it moves approval policy
to the board structure rather than the card. This creates an implicit coupling
between column layout and approval logic that is easy to break silently (e.g.
if a column is renamed or its type changes). It also requires an additional
configuration endpoint and UI to manage per-column settings, which is
disproportionate for v1.

**Option A** offers the right trade-off: the flag is explicit, card-scoped, and
travels through the full lifecycle with the card. The `false` default means
existing cards and low-stakes new cards are unaffected, while high-stakes cards
can opt in to human review at creation time.

The per-card model also aligns with the existing card-centric data model — the
`acceptanceCriteria`, `revisionContextNote`, and `approvedBy` fields are all
card-scoped. Keeping approval configuration at the same level maintains
conceptual consistency.

---

## Consequences

- **Positive — granular control:** Teams can apply approval requirements exactly
  where they are needed without restructuring their board layout.
- **Positive — safe default:** `false` by default ensures that existing cards
  and boards are unaffected by the migration, and that developers do not
  accidentally gate simple automation behind a review step.
- **Negative — DB migration required:** Adding `requiresApproval` to the `Card`
  model requires a Prisma migration. All existing rows receive the default value
  `false`, which is the correct safe default.
- **Negative — field must flow through the full API stack:** `requiresApproval`
  must be added to `CreateCardRequest`, `ApiCard`, `mapCard()`, the card-creation
  route, and the `createCardApi` store action. This is a mechanical but
  non-trivial propagation. See `docs/features/approval-workflow/TECH_SPEC.md`
  for the complete list of changes.

---

## Revisit when

- A team-wide "always require approval" policy is needed — at that point,
  consider a board-level or organisation-level flag that pre-sets this field
  for all newly created cards.
- Option C becomes attractive if board templates are introduced and column-level
  policy configuration has a natural home in the template editor.
