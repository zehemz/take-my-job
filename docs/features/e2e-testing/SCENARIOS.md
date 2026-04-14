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
| E2E-AUTH-004 | GitHub OAuth button redirect does not contain `client_id=undefined` | ✅ Implemented |
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
