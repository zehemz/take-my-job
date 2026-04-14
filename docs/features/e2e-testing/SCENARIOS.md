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

---

## Error states

| ID | Scenario | Status |
|----|----------|--------|
| E2E-ERR-001 | `GET /api/boards/:id` with nonexistent ID → 404 JSON | 🟡 Planned |
| E2E-ERR-002 | `POST /api/boards/:id/cards` with missing `title` → 400 | 🟡 Planned |
| E2E-ERR-003 | Network error during board fetch shows error state in UI | 🟡 Planned |

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
