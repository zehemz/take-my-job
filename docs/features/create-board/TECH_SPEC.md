# Create Board — Technical Spec

**Status:** ✅ Shipped  
**Implemented:** 2026-04-13  
**Note:** This feature was implemented reactively (user reported no board creation UI existed). Spec written retroactively to capture decisions made.

---

## Problem

The app had no way to create a board from the UI. The only path was seeding the DB directly or calling the API manually. With an empty DB, new users land on a blank board list with no affordance to get started.

---

## What was built

### API — `POST /api/boards`

`app/api/boards/route.ts`

- Requires an authenticated session (401 otherwise)
- Accepts `{ name: string }` — returns 400 if name is empty/missing
- Creates the board and **5 default columns in a single DB transaction** (via Prisma nested create)
- Returns the new `ApiBoardSummary` with HTTP 201

**Default columns (always created):**

| Position | Name        | ColumnType | isActiveState | isTerminalState |
|----------|-------------|------------|---------------|-----------------|
| 0        | Backlog     | inactive   | false         | false           |
| 1        | In Progress | active     | true          | false           |
| 2        | Review      | review     | true          | false           |
| 3        | Revision    | revision   | true          | false           |
| 4        | Done        | terminal   | false         | true            |

**Decision — why hardcode default columns:** Every board needs at least one active and one terminal column for the orchestrator to function. Letting users create an empty board would break agent dispatch silently. Hardcoded defaults are the safest starting point; column renaming/reordering can be added later.

### Store — `createBoardApi`

`lib/store.ts`

Calls `POST /api/boards`, prepends the new board to the `boards` list in Zustand state (optimistic-ish — the board comes back from the server), and returns the new board `id` for navigation.

### UI — New Board button + modal

`app/_components/BoardListClient.tsx`  
`app/_components/NewBoardModal.tsx`

- **+ New Board** button in the board list header (top-right)
- Modal: single text input (board name), helper text listing the 5 default columns, Cancel / Create Board buttons
- On success: navigates directly to the new board via `router.push(/boards/:id)`
- Modal uses `createPortal` to render outside the layout tree (consistent with `NewCardModal`)

### Contract type

`lib/api-types.ts` — added `CreateBoardRequest { name: string }`

---

## What this does not cover

- Custom column configuration at board creation time
- Board templates
- Board deletion or renaming (no UI — API-only for now)
- Access control per board (all authenticated users see all boards)
