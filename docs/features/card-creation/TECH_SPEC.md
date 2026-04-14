# Card Creation — Tech Spec

> Retroactive spec. Feature is ✅ Shipped.

---

## Overview

Users create cards from within a board column. A modal collects the card's fields and `POST`s to the API; on success the board is re-fetched and the modal closes.

---

## Entry point

`app/boards/[id]/_components/Column.tsx` renders a "+ New Card" button per column. Clicking it mounts `NewCardModal` via a React portal, passing the column's `columnId` and the board's `boardId`.

---

## Component — `NewCardModal`

**Path:** `app/boards/[id]/_components/NewCardModal.tsx`

**Props:**
```ts
interface Props {
  columnId: string;
  boardId: string;
  onClose: () => void;
}
```

**Fields:**

| Field | Input type | Required | Notes |
|---|---|---|---|
| Title | `<input type="text">` | ✓ | `data-testid="new-card-title-input"` |
| Agent Role | `<select>` | — | Defaults to `backend-engineer`; options from `AgentRole` union |
| Description | `<textarea rows=3>` | — | Free-form task description for the agent |
| Acceptance Criteria | `<textarea rows=4>` | — | One criterion per line; split on `\n` at submit time |
| GitHub Repo | `<input type="text">` | — | `org/repo` format; stored as `githubRepoUrl` in DB |
| GitHub Branch | `<input type="text">` | — | `feat/my-branch`; stored as `githubBranch` in DB |

**On submit:**
1. Splits `criteriaText` on newlines → array of `ApiAcceptanceCriterion` (with generated `id`, `passed: null`, `evidence: null`)
2. Calls `useKobaniStore.createCardApi(boardId, CreateCardRequest)`
3. On success: calls `fetchBoard(boardId)` then `onClose()`

**Portal:** rendered into `document.body` via `createPortal`. Backdrop click closes; `✕` button closes. No Escape key handler (modal is not long-lived).

---

## API — `POST /api/boards/[id]/cards`

**File:** `app/api/boards/[id]/cards/route.ts`

**Auth:** `auth()` guard — returns `401` if no session.

**Request body** (`CreateCardRequest` from `lib/api-types.ts`):
```ts
{
  title: string;           // required
  columnId: string;        // required — must belong to this board
  description?: string;
  acceptanceCriteria?: ApiAcceptanceCriterion[];
  role?: AgentRole;
  position?: number;
  githubRepo?: string;
  githubBranch?: string;
}
```

**Validation:**
- `title` and `columnId` are required → `400` if missing
- `columnId` must exist on the board (`boardId` from URL param) → `404` if not found

**Position:** if `position` is not supplied, the card is appended at `max(position) + 1` in the column.

**Response:** `201` with `ApiCard` (mapped via `mapCard(card, [], 'idle')`).

---

## Store integration

`useKobaniStore.createCardApi` in `lib/store.ts`:
- Calls `POST /api/boards/{boardId}/cards`
- Returns the created `ApiCard` on success, `null` on failure
- Does **not** optimistically update the store — the component calls `fetchBoard` after creation to get consistent server state

---

## E2E coverage

| ID | Scenario | Status |
|---|---|---|
| E2E-CARD-002 | Create card via UI modal → card appears on the board, then cleaned up | ✅ Implemented |
