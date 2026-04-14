# PRD: Audit Log

**Product:** Kobani
**Feature:** Audit Log — Immutable Event Stream
**Status:** Draft
**Author:** Lucas Bais
**Date:** 2026-04-14

---

## 1. Problem Statement

Kobani now has RBAC, environments, agent editing, and a full Kanban workflow for dispatching AI agents. Every feature works, but there is no trail of who did what and when. When something goes wrong — an agent misbehaves after a config change, a card is moved unexpectedly, or access permissions are altered — operators must reconstruct events from memory, Slack messages, or raw database timestamps. There is no single place to answer the question: "what happened?"

This creates three concrete problems:

1. **No accountability for configuration changes.** An admin edits an agent's system prompt or swaps its model. A week later the agent starts producing bad output. There is no record of the change, who made it, or what the previous value was.

2. **No visibility into card lifecycle.** Cards move through columns, get approved, retried, and edited by different people. When a card ends up in a bad state, there is no timeline to review — only the current snapshot in the database.

3. **No RBAC audit trail.** Users are added, removed, promoted to admin, and assigned to groups. If a security incident occurs, there is no log to determine when access was granted or revoked.

An audit log solves all three by recording every significant mutation as an immutable event with a timestamp, actor, and contextual metadata.

---

## 2. Goals

- Provide an **immutable, append-only event stream** of all significant mutations across cards, agents, environments, boards, RBAC, and system events.
- Give admins a **browsable audit log page** where they can see recent activity, filter by entity type or actor, and understand the timeline of changes.
- Capture enough **metadata** in each event to reconstruct what changed (e.g., "moved from column X to column Y", "model changed from claude-sonnet to claude-opus").
- Keep the implementation **simple and non-blocking** — audit logging must not slow down or break the operations it records.

### 2.1 Non-Goals (Phase 1)

- **Undo / revert.** The audit log is read-only. It does not provide a mechanism to roll back changes.
- **Real-time streaming.** The audit log page is a traditional paginated table, not a live-updating event stream.
- **Webhook delivery.** Events are stored in the database only. External notification (Slack, email, webhook) is a future extension.
- **Retention policies.** Phase 1 retains all events indefinitely. Configurable retention and archival are deferred.
- **Data export.** CSV/JSON export of audit events is deferred to Phase 2.
- **Filtering by metadata values.** Phase 1 supports filtering by entity type, entity ID, actor, and date range. Filtering by arbitrary metadata keys (e.g., "show me all moves to column X") is deferred.

---

## 3. User Personas

### 3.1 Admin / Operator

The person responsible for operating the Kobani instance. Uses the audit log to:

- Investigate incidents: "Who changed this agent's system prompt last week?"
- Verify RBAC changes: "When was this user added to the Backend Team group?"
- Monitor system health: "Are agent runs failing more than usual?"
- Satisfy compliance or reporting requirements: "Show me all admin actions in the last 30 days."

### 3.2 Team Lead

A senior team member (may or may not be admin) who wants to understand the flow of work:

- "Who approved this card?"
- "Why was this card retried three times?"
- "When was this agent's model changed?"

### 3.3 Future: External Auditor

Not in scope for Phase 1, but the data model is designed to support a future export feature that could produce an audit report for compliance purposes.

---

## 4. Events to Capture

### 4.1 Card Events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `card.created` | POST /api/boards/:id/cards | `{ boardId, columnId, title, role }` |
| `card.moved` | POST /api/cards/:id/move | `{ fromColumnId, toColumnId }` |
| `card.approved` | POST /api/cards/:id/approve | `{ approvedBy }` |
| `card.revision_requested` | POST /api/cards/:id/request-revision | `{ reason }` |
| `card.deleted` | DELETE /api/cards/:id | `{ title, boardId }` |
| `card.retried` | POST /api/cards/:id/retry | `{ attempt }` |
| `card.replied` | POST /api/cards/:id/reply | `{ message (truncated) }` |
| `card.edited` | PATCH /api/cards/:id | `{ changedFields[] }` |

### 4.2 Agent Events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `agent.edited` | PATCH /api/agents/:id | `{ changedFields[], previousValues }` |
| `agent.deleted` | DELETE /api/agents/:id | `{ name, role }` |

### 4.3 Environment Events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `environment.created` | POST /api/environments | `{ name }` |
| `environment.edited` | PATCH /api/environments/:id | `{ changedFields[] }` |
| `environment.deleted` | DELETE /api/environments/:id | `{ name }` |

### 4.4 Board Events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `board.created` | POST /api/boards | `{ name }` |
| `board.deleted` | DELETE /api/boards/:id | `{ name }` |

### 4.5 RBAC Events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `user.created` | POST /api/admin/users | `{ githubUsername, isAdmin }` |
| `user.admin_toggled` | PATCH /api/admin/users/:id | `{ githubUsername, isAdmin }` |
| `user.deleted` | DELETE /api/admin/users/:id | `{ githubUsername }` |
| `group.created` | POST /api/admin/groups | `{ name, agentRoles, environments }` |
| `group.updated` | PATCH /api/admin/groups/:id | `{ changedFields[] }` |
| `group.deleted` | DELETE /api/admin/groups/:id | `{ name }` |
| `group.member_added` | POST /api/admin/groups/:id/members | `{ githubUsername, groupName }` |
| `group.member_removed` | DELETE /api/admin/groups/:id/members/:userId | `{ githubUsername, groupName }` |

### 4.6 System Events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `agent_run.started` | Orchestrator dispatches run | `{ cardId, role, sessionId, attempt }` |
| `agent_run.completed` | Agent run finishes successfully | `{ cardId, role, sessionId }` |
| `agent_run.failed` | Agent run fails | `{ cardId, role, error (truncated) }` |
| `agent_run.blocked` | Agent run enters blocked state | `{ cardId, role, blockedReason }` |

---

## 5. User Stories

### 5.1 Admin investigates a config change

> As an admin, I want to see who changed an agent's system prompt and when, so I can correlate agent behavior changes with configuration changes.

Acceptance criteria:
- Admin navigates to `/audit-log`.
- Admin filters by entity type "agent" and sees a list of agent edit events.
- Each event shows the timestamp, actor (GitHub username), action, and the fields that changed.
- Admin can further filter by a specific agent ID to narrow the results.

### 5.2 Operator reviews card lifecycle

> As an operator, I want to see the full timeline of a card — from creation through approval — so I can understand why it took multiple retries.

Acceptance criteria:
- Admin navigates to `/audit-log` and filters by entity type "card" and a specific card ID.
- Events appear in reverse chronological order: created, moved to active, agent run started, agent run failed, retried, agent run started, agent run completed, moved to review, approved.
- Each event includes relevant metadata (e.g., which column the card moved to, which attempt number).

### 5.3 Security review of RBAC changes

> As an admin, I want to audit all access changes in the last 30 days, so I can verify that no unauthorized access was granted.

Acceptance criteria:
- Admin navigates to `/audit-log` and filters by entity types "user" and "group".
- Admin sets a date range for the last 30 days.
- The log shows all user creation, admin toggling, group creation, membership changes, and permission updates.

### 5.4 Non-admin user is denied access

> As a non-admin user, I should not be able to access the audit log, because it may contain sensitive information about other users and system configuration.

Acceptance criteria:
- Non-admin user navigating to `/audit-log` is redirected to `/`.
- `GET /api/audit-log` without admin session returns 401.
- `GET /api/audit-log` with non-admin session returns 403.

---

## 6. Scope

### Phase 1 (This Feature)

- Data model: `AuditLog` Prisma model.
- Recording helper: `recordAudit()` function called from API route handlers.
- API: `GET /api/audit-log` with pagination and filtering.
- UI: `/audit-log` admin-only page with a filterable, paginated table.
- Navigation: "Audit Log" link in top nav, visible only to admins.
- All events listed in section 4 are recorded.

### Phase 2 (Future)

- **Advanced filtering**: free-text search across metadata, filter by specific metadata keys.
- **CSV/JSON export**: download filtered audit events.
- **Retention policies**: configurable auto-deletion of events older than N days.
- **Event detail view**: click an event row to see full metadata in a side panel.
- **Entity timeline view**: a dedicated "history" tab on card/agent/environment detail pages showing only events for that entity.

---

## 7. Success Metrics

| Metric | Target | How to measure |
|--------|--------|----------------|
| Event coverage | 100% of mutations listed in section 4 produce an audit event | Integration tests verify event creation for each action |
| Zero mutation latency impact | Audit recording adds < 5ms p99 to API response time | Fire-and-forget recording; measure with server timing headers |
| Admin adoption | Admins visit `/audit-log` at least once per week | Page view analytics (future) |
| Incident resolution time | Reduced from "digging through DB" to "filter audit log" | Qualitative feedback from operators |

---

## 8. Open Questions

1. **Should system events (agent run started/completed/failed) include the actor?** These are triggered by the orchestrator, not a human. The actor could be `system` or the username of the person who originally moved the card to the active column. **Recommendation: use `system` as the actor for orchestrator-triggered events.** The card that triggered the run is captured in metadata, and the person who moved the card can be found by looking at the preceding `card.moved` event.

2. **How much metadata should be stored per event?** Storing full before/after snapshots for every edit would be comprehensive but expensive. Storing only changed field names is lightweight but less useful. **Recommendation: store changed field names plus previous values for key fields (model, system prompt first 200 chars, column names). Keep metadata under 4KB per event.**

3. **Should the audit log be in the same database or a separate one?** Same database keeps the implementation simple and allows joins if needed. A separate database improves isolation but adds operational complexity. **Recommendation: same database for Phase 1.** The audit log table is append-only and can be moved later if it grows too large.

4. **Should deleted entities' names be preserved in metadata?** When a board, card, or agent is deleted, the referenced entity no longer exists. Storing the name/title in the event metadata ensures the audit log remains human-readable. **Recommendation: yes, always include the entity name in metadata for delete events.**
