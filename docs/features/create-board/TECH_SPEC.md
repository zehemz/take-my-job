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
- Accepts `{ name: string, workspacePath?: string }` — returns 400 if name is empty/missing
- Creates the board and **6 default columns in a single DB transaction** (via Prisma nested create)
- If `WORKSPACE_REPO_URL` is configured:
  - Provisions a folder in the shared workspace repo via the GitHub Contents API
  - Uses user-provided `workspacePath` or auto-generates one from the board name + ID
  - Returns 409 if the workspace folder already exists
  - Saves `githubRepo` and `workspacePath` on the board record
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

### Workspace provisioning

`lib/workspace.ts`

When `WORKSPACE_REPO_URL` is set, board creation triggers folder provisioning in a shared GitHub repo:

1. **`slugify(name, id)`** — converts board name to a URL-safe slug with a 6-char ID suffix for uniqueness
2. **`ensureBoardFolder(boardName, workspacePath)`** — creates a `README.md` at the given path via the GitHub Contents API. Throws if the folder already exists.

Cards created on a board with a workspace repo auto-inherit `githubRepoUrl` and `githubBranch: "main"` (see `app/api/boards/[id]/cards/route.ts`). The agent prompt directs the agent to work inside `/workspace/repo/<workspacePath>/`.

**Environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKSPACE_REPO_URL` | No | GitHub URL of the shared workspace repo (e.g. `https://github.com/org/kobani-boards`) |
| `GITHUB_TOKEN` | Yes (if workspace enabled) | Fine-grained token with **Contents: Read and write** on the workspace repo |

### Contract type

`lib/api-types.ts` — `CreateBoardRequest { name: string, workspacePath?: string }`

---

## What this does not cover

- Custom column configuration at board creation time
- Board templates
- Board deletion or renaming (no UI — API-only for now)
- Access control per board (all authenticated users see all boards)
