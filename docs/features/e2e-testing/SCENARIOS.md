# E2E Test Scenarios — Kobani

This document is the authoritative catalog of all end-to-end test scenarios.
Every scenario listed here must have a corresponding test in `e2e/`.
IDs are stable — never reuse a retired ID.

---

## Auth flows (`e2e/auth.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-AUTH-001 | Unauthenticated visit to `/` redirects to `/login` | ✅ Implemented |
| E2E-AUTH-002 | Login page renders "Sign in to continue" heading and GitHub button | ✅ Implemented |
| E2E-AUTH-003 | Logo image on login page loads without broken-image icon | ✅ Implemented |
| E2E-AUTH-004 | ~~GitHub OAuth button redirect does not contain `client_id=undefined`~~ | ⛔ Retired |
| E2E-AUTH-005 | `/unauthorized` shows neutral "Access denied" copy without mentioning GitHub | ✅ Implemented |
| E2E-AUTH-006 | Direct `GET /api/boards` without session → `{"error":"Unauthorized"}` 401 | ✅ Implemented |
| E2E-AUTH-007 | `callbackUrl=//evil.com` is sanitised — browser stays on our domain | ✅ Implemented |
| E2E-AUTH-008 | `POST /api/cards/:id/move` without session → 401 | ✅ Implemented |
| E2E-AUTH-009 | Session cookie with wrong `AUTH_SECRET` is rejected → redirect to `/login` | 🟡 Planned |
| E2E-AUTH-010 | Session max-age: 24h expiry enforced (requires time-travel or short maxAge in test env) | 🟡 Planned |

---

## Board list (`e2e/board.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-BOARD-001 | Authenticated visit to `/` renders `[data-testid="board-list"]` and board cards | ✅ Implemented |
| E2E-BOARD-002 | Navigating to a board page renders `[data-testid="column"]` elements | ✅ Implemented |
| E2E-BOARD-003 | `[data-testid="user-menu-trigger"]` visible in nav after auth | ✅ Implemented |
| E2E-BOARD-004 | Clicking user menu trigger opens dropdown with `@githubUsername` | ✅ Implemented |
| E2E-BOARD-005 | Clicking "Sign out" in dropdown redirects to `/login` | ✅ Implemented |
| E2E-BOARD-006 | Board list shows correct card and column counts from real DB | 🟡 Planned |

---

## Card management (`e2e/card.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-CARD-001 | `GET /api/boards` response has correct shape (id, name, createdAt) | ✅ Implemented |
| E2E-CARD-002 | Create card via UI modal → card appears on the board, then cleaned up | ✅ Implemented |
| E2E-CARD-003 | Move card via API → `columnId` changes, verified on re-fetch | ✅ Implemented |
| E2E-CARD-004 | `POST /api/cards/:id/move` without session → 401 | ✅ Implemented |
| E2E-CARD-005 | `PATCH /api/cards/:id` without session → 401 | ✅ Implemented |
| E2E-CARD-006 | Card title appears in correct column after drag-and-drop | 🟡 Planned |
| E2E-CARD-007 | `approvedBy` field is always set from session on server, not from request body | 🟡 Planned |
| E2E-CARD-008 | Card detail modal opens on click and shows title, description, agent status | 🟡 Planned |
| E2E-CARD-009 | Delete button visible in card detail modal footer | ✅ Implemented |
| E2E-CARD-010 | Delete confirm step required; card disappears and modal closes after confirm | ✅ Implemented |
| E2E-CARD-011 | Delete confirm cancel returns footer to initial delete button (no deletion) | ✅ Implemented |
| E2E-CARD-012 | Clicking title in modal enters edit mode and shows Save/Cancel buttons | ✅ Implemented |
| E2E-CARD-013 | Save updates title (API-persisted); Cancel discards changes | ✅ Implemented |
| E2E-CARD-014 | Add card button is only visible on inactive columns | ✅ Implemented |
| E2E-CARD-015 | `POST /api/cards/:id/retry` without session → 401 | ✅ Implemented |
| E2E-CARD-016 | `POST /api/cards/:id/retry` on card with no agent runs → 400 | ✅ Implemented |
| E2E-CARD-017 | Delete a card that has agent run history succeeds (no FK constraint 500) | ✅ Implemented |
| E2E-CARD-018 | Card in inactive column — title, description, criteria edit controls are visible and functional | 🟡 Planned |
| E2E-CARD-019 | Card in non-inactive column — edit controls hidden, fields are read-only, `PATCH` returns 403 | 🟡 Planned |

---

## Approval workflow (`e2e/card.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| APPROVAL-001 | `POST /api/cards/:id/approve` without session → 401 | ✅ Implemented |
| APPROVAL-002 | `POST /api/cards/:id/approve` on a card not in a review column → 400 | ✅ Implemented |
| APPROVAL-003 | `POST /api/cards/:id/request-revision` without session → 401 | ✅ Implemented |
| APPROVAL-004 | `PATCH /api/cards/:id/move` with invalid transition (active → terminal) → 400 | ✅ Implemented |
| APPROVAL-005 | `POST /api/boards/:id/cards` with `requiresApproval: true` → field persists on fetch | ✅ Implemented |

---

## Board management (`e2e/board.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-BOARD-DELETE-001 | Delete board button visible on board detail page | 🟡 Planned |
| E2E-BOARD-DELETE-002 | Delete modal: confirm button disabled until board name typed exactly | 🟡 Planned |
| E2E-BOARD-DELETE-003 | Typing board name and confirming deletes board and redirects to `/` | 🟡 Planned |

---

## Drag and drop (`e2e/drag.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-DRAG-001 | Drag card from column A to column B → card appears in column B | 🟡 Planned |
| E2E-DRAG-002 | `moveCardApi` is called with correct `columnId` after drag | 🟡 Planned |
| E2E-DRAG-003 | Optimistic update shows card in new column before API confirms | 🟡 Planned |

---

## Real-time SSE (`e2e/sse.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-SSE-001 | SSE connection established at `/api/events/:cardId` | 🟡 Planned |
| E2E-SSE-002 | SSE endpoint without session → 401 | 🟡 Planned |
| E2E-SSE-003 | Agent status badge updates in UI when SSE event arrives | 🟡 Planned |

---

## Agent management (`e2e/agents.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-AGENT-001 | Authenticated visit to `/agents` renders page heading "Agents" | 🟡 Planned |
| E2E-AGENT-002 | `/agents` lists one row per `AgentConfig` returned by `GET /api/agents` | 🟡 Planned |
| E2E-AGENT-003 | `/agents` shows empty-state message when no agents are configured | 🟡 Planned |
| E2E-AGENT-004 | `GET /api/agents` without session → `{"error":"Unauthorized"}` 401 | 🟡 Planned |
| E2E-AGENT-005 | Each agent row displays: role, agent ID, version, environment ID, created date | 🟡 Planned |
| E2E-AGENT-006 | `DELETE /api/agents/:id` without session → 401 | 🟡 Planned |
| E2E-AGENT-007 | Delete button on a row triggers confirmation, then calls DELETE, then row disappears | 🟡 Planned |
| E2E-AGENT-008 | `DELETE /api/agents/:id` with valid id removes agent from Anthropic and DB | 🟡 Planned |

## Agent Details View (`e2e/agents.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-AGENT-009 | Navigate to `/agents`, click a healthy agent name → lands on `/agents/[id]` showing all fields | 🟡 Planned |
| E2E-AGENT-010 | Navigate to `/agents/nonexistent-id` → page shows "Agent not found" error message | 🟡 Planned |
| E2E-AGENT-011 | Back link `← Agents` on detail page returns to `/agents` | 🟡 Planned |

---

## Attention Queue (`e2e/attention.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-ATTENTION-001 | Navigate to `/attention` → page renders "Attention" heading | 🟡 Planned |
| E2E-ATTENTION-002 | Blocked card appears in Attention Queue with status badge and blocked reason summary | 🟡 Planned |
| E2E-ATTENTION-003 | Failed card appears in Attention Queue with "failed" status badge | 🟡 Planned |
| E2E-ATTENTION-004 | Pending-approval card shows "Approve" and "Request revision" buttons | 🟡 Planned |
| E2E-ATTENTION-005 | Clicking card title in Attention Queue opens CardDetailModal | 🟡 Planned |
| E2E-ATTENTION-006 | Blocked card older than 1 hour shows "URGENT" indicator | 🟡 Planned |
| E2E-ATTENTION-007 | Empty state shown when no cards need attention | 🟡 Planned |

---

## Blocked column + human reply (`e2e/blocked.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-BLOCKED-001 | `POST /api/cards/:id/reply` without session → 401 | 🟡 Planned |
| E2E-BLOCKED-002 | `POST /api/cards/:id/reply` on card not in blocked column → 400 | 🟡 Planned |
| E2E-BLOCKED-003 | `POST /api/cards/:id/reply` with valid message → card moves to active column | 🟡 Planned |
| E2E-BLOCKED-004 | Blocked column header shows pulsing amber indicator when cards present | 🟡 Planned |
| E2E-BLOCKED-005 | BlockedBanner in card detail shows blocked reason and reply textarea | 🟡 Planned |

---

## Error states

| ID | Scenario | Status |
|----|----------|--------|
| E2E-ERR-001 | `GET /api/boards/:id` with nonexistent ID → 404 JSON | 🟡 Planned |
| E2E-ERR-002 | `POST /api/boards/:id/cards` with missing `title` → 400 | 🟡 Planned |
| E2E-ERR-003 | Network error during board fetch shows error state in UI | 🟡 Planned |

---

## Sessions List (`e2e/sessions.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-SESSION-001 | Navigate to `/sessions` → table renders with Status, Title, Agent, Environment, Card, Role, Created columns | 🟡 Planned |
| E2E-SESSION-002 | Sessions linked to a Kobani card show a clickable board link in the Card column | 🟡 Planned |
| E2E-SESSION-003 | Sessions not linked to a card show "—" in Card and Role columns | 🟡 Planned |
| E2E-SESSION-004 | Status badges display correct colour per status (running=blue, idle=zinc, terminated=dim, rescheduling=amber) | 🟡 Planned |
| E2E-SESSION-005 | `GET /api/sessions` without session → `{"error":"Unauthorized"}` 401 | 🟡 Planned |

---

## Environments Management (`e2e/environments.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-ENV-001 | Navigate to `/environments` → table renders with Name, Network, ID columns visible | 🟡 Planned |
| E2E-ENV-002 | Click Delete on an environment row → inline confirmation (Confirm?/Yes/Cancel) appears | 🟡 Planned |
| E2E-ENV-003 | Click Cancel → row unchanged | 🟡 Planned |
| E2E-ENV-004 | Click Yes → spinner shows → row disappears after success | 🟡 Planned |

## Agent Edit (`e2e/agents.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-AGENT-012 | Click pencil icon on Name field → edit mode appears with Save/Cancel | 🟡 Planned |
| E2E-AGENT-013 | Edit name and click Save → field updates, version increments | 🟡 Planned |
| E2E-AGENT-014 | Edit model via dropdown and Save → model updates | 🟡 Planned |
| E2E-AGENT-015 | Edit system prompt → confirmation dialog appears → confirm → saves | 🟡 Planned |
| E2E-AGENT-016 | Cancel during edit → reverts to original value | 🟡 Planned |
| E2E-AGENT-017 | Orphaned agent → edit icons not shown, disabled banner visible | 🟡 Planned |

## Agent Tools & MCP Configuration (`e2e/agents.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-AGENT-018 | Agent detail page shows Built-in Tools section with 8 tool rows | 🟡 Planned |
| E2E-AGENT-019 | Toggle a tool off and save → tool config updates | 🟡 Planned |
| E2E-AGENT-020 | Change permission policy to "Ask first" and save → policy updates | 🟡 Planned |
| E2E-AGENT-021 | MCP Servers section shows current servers from Anthropic | 🟡 Planned |
| E2E-AGENT-022 | Add preset MCP server → row appears with pre-filled name/URL | 🟡 Planned |
| E2E-AGENT-023 | Add custom MCP server with name + URL → save → persists | 🟡 Planned |
| E2E-AGENT-024 | Remove MCP server → save → server removed from agent | 🟡 Planned |
| E2E-AGENT-025 | Orphaned agent → tools and MCP sections show disabled state | 🟡 Planned |

---

## Environment Detail & Edit (`e2e/environments.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-ENV-005 | Click environment name in list → navigates to `/environments/[id]` detail page | 🟡 Planned |
| E2E-ENV-006 | Edit environment name → Save → name updates | 🟡 Planned |
| E2E-ENV-007 | Edit description → Save → description updates | 🟡 Planned |
| E2E-ENV-008 | Switch network from unrestricted to limited → configure hosts → Save → persists | 🟡 Planned |
| E2E-ENV-009 | Edit packages (add npm package) → Save → persists | 🟡 Planned |
| E2E-ENV-010 | Navigate to `/environments/nonexistent` → shows "not found" | 🟡 Planned |

---

## RBAC — Role-Based Access Control (`e2e/rbac.spec.ts`)

| ID | Scenario | Status |
|----|----------|--------|
| E2E-RBAC-001 | `GET /api/admin/users` without admin role → 403 Forbidden | 🟡 Planned |
| E2E-RBAC-002 | `GET /api/admin/groups` without admin role → 403 Forbidden | 🟡 Planned |
| E2E-RBAC-003 | Admin can create a user via `POST /api/admin/users` with valid GitHub username | 🟡 Planned |
| E2E-RBAC-004 | Admin can create a group with agent roles + environment access | 🟡 Planned |
| E2E-RBAC-005 | Admin can add a user to a group via `POST /api/admin/groups/:id/members` | 🟡 Planned |
| E2E-RBAC-006 | Non-admin user cannot move a card with agent role outside their group access → 403 | 🟡 Planned |
| E2E-RBAC-007 | Non-admin user can move a card with agent role inside their group access → 200 | 🟡 Planned |
| E2E-RBAC-008 | Non-admin user cannot approve a card outside their group access → 403 | 🟡 Planned |
| E2E-RBAC-009 | Board detail response includes `canInteract: false` for cards outside user's access | 🟡 Planned |
| E2E-RBAC-010 | Board detail response includes `canInteract: true` for cards within user's access | 🟡 Planned |
| E2E-RBAC-011 | Admin sees all cards with `canInteract: true` regardless of group membership | 🟡 Planned |
| E2E-RBAC-012 | Removing user from group immediately restricts their card access → 403 on next request | 🟡 Planned |
| E2E-RBAC-013 | `PATCH /api/agents/:id` without admin role → 403 Forbidden | 🟡 Planned |
| E2E-RBAC-014 | `DELETE /api/environments/:id` without admin role → 403 Forbidden | 🟡 Planned |
| E2E-RBAC-015 | Cannot delete the last admin user → 400 | 🟡 Planned |
| E2E-RBAC-016 | Cannot demote the last admin → 400 | 🟡 Planned |
| E2E-RBAC-017 | Navigate to `/access` as admin → page renders Users/Groups tabs | 🟡 Planned |
| E2E-RBAC-018 | Navigate to `/access` as non-admin → redirected to `/` | 🟡 Planned |
| E2E-RBAC-019 | Wildcard `*` agent role grants access to all agent roles | 🟡 Planned |
| E2E-RBAC-020 | Wildcard `*` environment grants access to all environments | 🟡 Planned |
| E2E-RBAC-021 | "Access" nav link visible only to admin users | 🟡 Planned |
| E2E-RBAC-022 | Kanban card with `canInteract: false` is visually muted (opacity-50) and not draggable | 🟡 Planned |

---

## How to add a new scenario

1. Pick the next available ID in the relevant group (never reuse a retired one).
2. Add a row to this table with status `🟡 Planned`.
3. Write the test in the matching `e2e/*.spec.ts` file.
4. Update status to `✅ Implemented` once the test passes in CI.

### Status legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and passing |
| 🟡 | Planned — not yet written |
| ⛔ | Retired / intentionally not tested |
