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
| [Card creation UI](./features/card-creation/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Create Board UI](./features/create-board/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Card Detail View](./features/card-detail/) | ✅ Shipped | — | ✓ | ✓ | — |
| [Manual card retry](./features/manual-retry/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Delete Board](./features/delete-board/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| SSE real-time updates | ✅ Shipped | — | — | — | — |
| [E2E Testing](./features/e2e-testing/SCENARIOS.md) | 🟠 In Progress | — | — | ✓ | — |
| [Approval Workflow](./features/approval-workflow/) | ✅ Shipped | ✓ | ✓ | ✓ | — |
| [Approval Confirmation Step](./features/approval-workflow/APPROVAL_CONFIRMATION_TECH_SPEC.md) | ✅ Shipped | ✓ | ✓ | ✓ | — |
| [Agent Management](./features/agent-management/) | ✅ Shipped | ✓ | ✓ | ✓ | — |
| [Agent Details View](./features/agent-details/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Board-level GitHub Repo](./features/create-board/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Blocked Column + Human Reply](./features/blocked-column/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Sessions List](./features/sessions/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Attention Queue](./features/attention-queue/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Notifications Popup](./features/notifications-popup/) | ✅ Shipped | ✓ | ✓ | ✓ | — |
| [Agent Edit](./features/agent-edit/) | ✅ Shipped | ✓ | — | — | — |
| [Agent Tools & MCP](./features/agent-edit/PRD.md) | ✅ Shipped | ✓ | — | — | — |
| [Environment Detail & Edit](./features/environments/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [RBAC — Role-Based Access Control](./features/rbac/) | ✅ Shipped | ✓ | ✓ | ✓ | ✓ |
| [Stateless Orchestrator](./features/stateless-orchestrator/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |
| [Environment Creation with Presets](./features/environment-creation/) | ✅ Shipped | ✓ | — | ✓ | — |
| [Per-Card Environment Override](./features/per-card-environment/TECH_SPEC.md) | ✅ Shipped | — | — | ✓ | — |

**Status legend:** ✅ Shipped · 🔵 In Design · 🟠 In Progress · 🟡 Planned · ⛔ Blocked

---

## Architecture

- [System Overview](./architecture/overview.md) — data flow, services, key constraints
- [ADR-001 — JWT sessions over DB-backed sessions](./architecture/decisions/ADR-001-jwt-sessions.md)
- [ADR-002 — Deploy boundary as revocation boundary](./architecture/decisions/ADR-002-deploy-boundary-revocation.md)
- [ADR-003 — Card creation restricted to inactive columns](./architecture/decisions/ADR-003-card-creation-restricted-to-inactive-columns.md)
- [ADR-004 — Column transition rules](./architecture/decisions/ADR-004-column-transition-rules.md)
- [ADR-005 — Requires-approval per card](./architecture/decisions/ADR-005-requires-approval-per-card.md)
- [ADR-006 — Mutation loading states](./architecture/decisions/ADR-006-mutation-loading-states.md)
- [ADR-007 — Anthropic as source of truth for agent data](./architecture/decisions/ADR-007-anthropic-as-agent-source-of-truth.md)

---

## Definitions

- [Glossary](./definitions/glossary.md) — domain terms: AgentStatus, ColumnType, roles, run lifecycle

---

## How to add a new feature

1. Create `docs/features/<feature-name>/`
2. Copy the relevant templates: `PRD.md`, `DESIGN.md`, `TECH_SPEC.md`
3. Add a row to the Feature Registry above with status `🟡 Planned`
4. Update status as work progresses
