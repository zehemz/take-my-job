# Kobani — Documentation Index

> Single source of truth for what's planned, in progress, and shipped.
> Each feature links to its spec folder. Update status here when work changes state.

---

## Feature Registry

| Feature | Status | PRD | Design | Tech Spec | Security Review |
|---------|--------|-----|--------|-----------|-----------------|
| [API Layer](./features/api-layer/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Auth — GitHub OAuth + Whitelist](./features/auth/) | ✅ Shipped | ✓ | ✓ | ✓ | ✓ |
| Kanban ↔ DB wiring (Zustand → API) | ✅ Shipped | — | — | — | — |
| Card creation UI | ✅ Shipped | — | — | — | — |
| [Create Board UI](./features/create-board/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Card Detail View](./features/card-detail/DESIGN.md) | 🔵 In Design | — | ✓ | — | — |
| SSE real-time updates | 🟡 Planned | — | — | — | — |
| [E2E Testing](./features/e2e-testing/SCENARIOS.md) | 🟠 In Progress | — | — | ✓ | — |

**Status legend:** ✅ Shipped · 🔵 In Design · 🟠 In Progress · 🟡 Planned · ⛔ Blocked

---

## Architecture

- [System Overview](./architecture/overview.md) — data flow, services, key constraints
- [ADR-001 — JWT sessions over DB-backed sessions](./architecture/decisions/ADR-001-jwt-sessions.md)
- [ADR-002 — Deploy boundary as revocation boundary](./architecture/decisions/ADR-002-deploy-boundary-revocation.md)

---

## Definitions

- [Glossary](./definitions/glossary.md) — domain terms: AgentStatus, ColumnType, roles, run lifecycle

---

## How to add a new feature

1. Create `docs/features/<feature-name>/`
2. Copy the relevant templates: `PRD.md`, `DESIGN.md`, `TECH_SPEC.md`
3. Add a row to the Feature Registry above with status `🟡 Planned`
4. Update status as work progresses
