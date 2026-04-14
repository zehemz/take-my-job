# Delete Board — Technical Spec

**Status:** 🟠 In Progress
**Author:** Claude Code
**Date:** 2026-04-13

---

## Problem

Once a board is created there is no way to delete it from the UI. Users accumulate test or abandoned boards with no recourse.

---

## Requirements

- Delete button is present on the board detail page (inside the board header).
- Clicking it opens a confirmation modal.
- The modal requires the user to type the exact board name before the confirm button is enabled — prevents accidental deletion.
- On confirmation: board and all its columns and cards are deleted (cascade in DB).
- On success: navigate back to `/` (board list).
- The API requires authentication; unauthenticated requests receive 401.

---

## API

### `DELETE /api/boards/:id`

`app/api/boards/[id]/route.ts` — add `DELETE` handler.

- `auth()` guard (401 if no session).
- Fetch the board first; return 404 if not found.
- `prisma.board.delete({ where: { id } })` — Prisma cascades to columns and cards via schema's `onDelete: Cascade`.
- Returns 204 No Content.

---

## Store

`lib/store.ts` — add `deleteBoardApi(id: string): Promise<boolean>`.

- `DELETE /api/boards/:id`
- On success: remove board from `boards` array in Zustand state, return `true`.
- On error: return `false`.

---

## UI

### Delete button in board header

`app/boards/[id]/_components/BoardView.tsx`

- Add a `Delete board` button (or destructive icon button) next to the `···` overflow button in the board header.
- Clicking it sets `showDeleteModal = true`.

### Confirmation modal — `DeleteBoardModal.tsx`

`app/boards/[id]/_components/DeleteBoardModal.tsx`

Props:
```ts
interface Props {
  board: { id: string; name: string };
  onClose: () => void;
}
```

Behaviour:
- Renders via `createPortal` to `document.body` (consistent with `NewBoardModal`, `NewCardModal`).
- Modal title: "Delete board"
- Warning copy: "This will permanently delete **{board.name}** and all its columns and cards. This cannot be undone."
- Input label: `Type "{board.name}" to confirm`
- Input placeholder: board name
- Confirm button: disabled until input value === board name (exact, case-sensitive).
- Confirm button text: "Delete board" (red / `bg-red-600 hover:bg-red-500`).
- On confirm: calls `deleteBoardApi`, then `router.push('/')`.
- Cancel / backdrop click closes the modal.

---

## Styling

Consistent with existing modals (zinc-900 background, zinc-800 border, zinc-100 text). Confirm button uses red to signal danger:

```
bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white
```

---

## data-testid attributes

| Element | testid |
|---------|--------|
| Delete board button (in header) | `delete-board-button` |
| Confirmation modal | `delete-board-modal` |
| Name confirmation input | `delete-board-name-input` |
| Confirm button | `delete-board-confirm` |

---

## E2E scenarios

See `docs/features/e2e-testing/SCENARIOS.md` — BOARD-DELETE-001 through BOARD-DELETE-003.

---

## What this does not cover

- Soft-delete / archive (out of scope)
- Bulk delete
- Permission checks beyond authentication (all authenticated users can delete any board)
