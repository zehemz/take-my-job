# Kobani — Frontend Sprint Plan

## 1. Sprint Goal

Build a fully interactive Kanban board UI in Next.js 14 with in-memory state and hardcoded seed data, covering every screen and component state defined in the wireframes, so that a backend engineer can later wire real API calls to a working shell.

---

## 2. Out of Scope

The following are explicitly **not** being built in this sprint:

- **Backend / API routes** — no `app/api/` routes, no server actions that touch a database
- **Database** — Prisma schema exists but is not used; no migrations, no queries
- **Anthropic API** — no agent dispatch, no SSE streams, no real-time output
- **Authentication** — no login, no session, no user identity
- **Notifications delivery** — the bell icon renders a static count; no push or email
- **Real drag-and-drop persistence** — moves update in-memory state only
- **CLI attach** — the "Connect via CLI" copy-button is rendered but clicking it does nothing
- **Concurrency cap enforcement** — the cap is not enforced; status badges are display-only
- **GitHub integration** — the GitHub field on the card form is rendered but not wired
- **Retry countdown timer** — the countdown renders a static value from seed data
- **Attention Queue actions** — Reply, Approve, and Request Revision buttons update in-memory state only

---

## 3. Pages & Routes

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Board list — shows all boards as cards with name and column count |
| `/boards/[id]` | `app/boards/[id]/page.tsx` | Kanban board — full column + card grid with drag-and-drop |
| `/attention` | `app/attention/page.tsx` | Attention Queue — cross-board view of blocked, revision, and pending-approval cards |

A root layout (`app/layout.tsx`) provides the persistent top navigation bar present in every wireframe.

---

## 4. Component Tree

```
app/layout.tsx
└── RootLayout
    ├── TopNav                        # App header: logo, board breadcrumb, bell icon, user avatar, board menu
    │   ├── NotificationBell          # Bell icon with unread count badge
    │   └── UserMenu                  # Avatar + display name, static dropdown placeholder
    └── {children}

app/page.tsx
└── BoardListPage
    └── BoardGrid                     # Responsive grid of boards
        └── BoardCard                 # Single board summary card (name, column count, last-updated)

app/boards/[id]/page.tsx
└── BoardPage
    ├── BoardHeader                   # Board title + "···" settings button
    └── KanbanBoard                   # Horizontally scrolling column container, DnD context root
        ├── DragOverlay               # @dnd-kit floating preview of the card being dragged
        └── Column (×N)               # A single column with its header and card list
            ├── ColumnHeader          # Column name, column type badge (Inactive/Active/Review/etc.), card count
            ├── CardList              # SortableContext wrapper; droppable area for cards
            │   └── KanbanCard (×N)   # Compact card face shown on the board
            │       ├── CardTitle     # Title text, truncated to two lines
            │       ├── AgentStatusBadge # Coloured pill: idle · running · blocked · failed · evaluating · evaluation-failed · pending-approval · completed
            │       └── CardMeta      # Assignee avatar/name, fail count if evaluation-failed
            └── AddCardButton         # "+ Add card" trigger at column bottom

app/boards/[id]/_components/CardDetailModal.tsx
└── CardDetailModal                   # Full-screen modal/drawer opened by clicking a card
    ├── CardDetailHeader              # Title, current AgentStatusBadge, close button
    ├── CardMetaRow                   # Role, attempt N/5, time since start/block
    ├── AcceptanceCriteriaList        # Per-criterion row with pass/fail icon and evidence text
    │   └── CriterionRow              # Checkbox/tick/cross icon + text + evidence (if available)
    ├── AgentOutputPanel              # Scrollable pre-formatted agent output with Markdown rendering
    │   └── AgentOutputBlock (×N)     # One block per AgentRun attempt; collapsible for past runs
    ├── BlockedReasonPanel            # Shown only when status === "blocked": reason text + reply form + CLI command
    │   ├── BlockedReasonText         # The agent's stated blocker reason
    │   ├── ReplyForm                 # Textarea + "Send to agent" button (updates in-memory state only)
    │   └── CLIAttachCommand          # Monospace command + copy button
    ├── EvaluationReportPanel         # Shown when status === "evaluation-failed" or "pending-approval"
    │   └── CriterionEvidenceRow (×N) # Pass/fail icon + criterion text + evidence string
    ├── RevisionContextForm           # Shown only when card is in a Revision column; optional note textarea + "Send back to In Progress" button
    ├── PendingApprovalActions        # Shown only when status === "pending-approval"; "Request revision" + "Approve & close" buttons
    └── RetrySchedulePanel            # Shown only when status === "failed"; attempt history rows + next retry time

app/attention/page.tsx
└── AttentionQueuePage
    ├── AttentionQueueHeader          # "Needs Attention · N items" heading
    └── AttentionGroupList            # Three sections: Blocked, Revision Needed, Pending Approval
        └── AttentionGroup (×3)       # Section heading + list of attention items
            └── AttentionItem (×N)    # Single attention card: state badge, urgency flag, card title, board/column path, summary text, action buttons

app/_components/
├── TopNav.tsx
├── NotificationBell.tsx
├── UserMenu.tsx
├── AgentStatusBadge.tsx              # Shared across board and attention queue; accepts status prop
└── EmptyState.tsx                    # Generic "nothing here" placeholder used in empty columns and empty queue
```

---

## 5. In-Memory Data Model

These TypeScript types are the single source of truth for both the store and the seed data.

```typescript
// Column types drive visual treatment and (in production) agent dispatch behaviour.
export type ColumnType = 'inactive' | 'active' | 'review' | 'revision' | 'terminal';

// The complete set of badge states from PRD §1.1.5 and wireframes.
export type AgentStatus =
  | 'idle'
  | 'running'
  | 'blocked'
  | 'failed'
  | 'evaluating'
  | 'evaluation-failed'
  | 'pending-approval'
  | 'completed';

export type AgentRole =
  | 'backend-engineer'
  | 'qa-engineer'
  | 'tech-lead'
  | 'content-writer'
  | 'product-spec-writer'
  | 'designer';

export interface AcceptanceCriterion {
  id: string;
  text: string;
  passed: boolean | null;   // null = not yet evaluated
  evidence: string | null;  // populated by evaluation agent output
}

export interface AgentRun {
  id: string;
  cardId: string;
  role: AgentRole;
  status: AgentStatus;
  attempt: number;          // 1-based; max 5
  startedAt: string;        // ISO timestamp
  endedAt: string | null;
  output: string;           // full accumulated markdown output (append-only in production)
  blockedReason: string | null;
  retryAfterMs: number | null; // milliseconds until next retry; null when not in failed state
}

export interface Card {
  id: string;
  columnId: string;
  boardId: string;
  position: number;         // 0-based sort order within the column
  title: string;
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
  role: AgentRole;
  assignee: string;         // display name; e.g. "@lucas"
  githubRepo: string | null;
  githubBranch: string | null;
  agentStatus: AgentStatus;
  currentAgentRunId: string | null;
  agentRuns: AgentRun[];
  revisionContextNote: string | null; // human note added before sending back to In Progress
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  type: ColumnType;
  position: number;         // left-to-right display order
}

export interface Board {
  id: string;
  name: string;
  createdAt: string;
}

// Top-level store shape
export interface KobaniStore {
  boards: Board[];
  columns: Column[];
  cards: Card[];
  agentRuns: AgentRun[];
}
```

---

## 6. Fake Seed Data

The seed data must make every badge state and every special panel visible without any user interaction. Use three boards to match the Attention Queue wireframe (W-09), which references "Sprint 12 Board", "Content Pipeline", and "Platform Docs".

**Board 1 — "Sprint 12 Board"**
Five columns in order: Backlog (inactive), In Progress (active), Review (review), Revision Needed (revision), Done (terminal).

Cards (one per interesting state):
1. `idle` — "API rate limit documentation" in Backlog. No AgentRun. Status: idle.
2. `running` — "Auth flow redesign" in In Progress. One AgentRun (attempt 1, status: running). Partial markdown output. All criteria unchecked.
3. `blocked` — "Database connection pooling" in In Progress. One AgentRun (status: blocked). blockedReason set. blockedAt more than 1 hour ago (so it shows as URGENT in the Attention Queue).
4. `failed` — "Rate limiter middleware" in In Progress. Two AgentRuns (attempt 1 failed, attempt 2 status: failed with retryAfterMs: 38000). Retry schedule visible.
5. `evaluating` — "JWT refresh endpoint" in Review. One AgentRun (status: evaluating). All criteria showing "checking...".
6. `evaluation-failed` — "Remove legacy session cookie" in Revision Needed. One evaluation AgentRun (status: evaluation-failed). Two criteria passed, two failed, with evidence strings.
7. `pending-approval` — "Onboarding copy update" passed into Done via Review. Status: pending-approval. All criteria passed with evidence. approvedBy: null.
8. `completed` — "Remove deprecated endpoints" in Done. Status: completed. approvedBy: "@lucas", approvedAt set.

**Board 2 — "Content Pipeline"**
Four columns: Backlog (inactive), Drafting (active), Revision Needed (revision), Published (terminal).

Cards:
1. "Onboarding copy update" in Revision Needed. Status: evaluation-failed. Two criteria failed ("tone mismatch", "missing CTA on step 3"). Used in Attention Queue W-09.
2. "Blog post: AI in devtools" in Drafting. Status: running.
3. "Q2 release notes" in Backlog. Status: idle.

**Board 3 — "Platform Docs"**
Four columns: Backlog (inactive), In Progress (active), Review (review), Published (terminal).

Cards:
1. "API rate limit documentation" in Review. Status: pending-approval. All 3 criteria passed with evidence. Used in Attention Queue W-09.
2. "SDK quickstart guide" in In Progress. Status: running.

This gives: 2 boards with blocked cards, 1 board with pending-approval, covers all 8 badge states, and produces the exact 3 Attention Queue items from W-09. Every column type (inactive, active, review, revision, terminal) appears at least once.

---

## 7. State Management Decision

**Decision: Zustand**

Rationale: Zustand's flat store with selector-based subscriptions avoids the prop-drilling and re-render overhead that Context + useReducer incurs when multiple deeply nested components (Column, KanbanCard, CardDetailModal) need to read and mutate the same cards array.

The store must support the following operations (actions):

```typescript
// Board operations
createBoard(name: string): void
renameBoard(boardId: string, name: string): void
deleteBoard(boardId: string): void

// Column operations
createColumn(boardId: string, name: string, type: ColumnType): void
renameColumn(columnId: string, name: string): void
deleteColumn(columnId: string): void
reorderColumns(boardId: string, orderedColumnIds: string[]): void

// Card operations
createCard(columnId: string, boardId: string, fields: Partial<Card>): void
updateCard(cardId: string, fields: Partial<Card>): void
deleteCard(cardId: string): void
moveCard(cardId: string, targetColumnId: string, targetPosition: number): void
reorderCard(cardId: string, targetPosition: number): void

// Modal / UI state (co-located in the same store for simplicity)
openCardDetail(cardId: string): void
closeCardDetail(): void
selectedCardId: string | null

// Attention Queue actions (in-memory only)
approveCard(cardId: string): void
requestRevision(cardId: string, reason: string): void
sendRevisionContext(cardId: string, note: string): void
```

Store file location: `lib/store.ts`
Seed data file location: `lib/seed.ts` — exports `initialState: KobaniStore` imported by the store's initial state.

---

## 8. Drag and Drop Library

**Decision: `@dnd-kit/core` + `@dnd-kit/sortable`**

Rationale: `@dnd-kit` is already present in `package.json` (versions `^6.3.1` and `^10.0.0`), is actively maintained, has first-class React 18 support, and its composable sensor/modifier model handles both cross-column moves and within-column reorders with the same primitives. No additional install is needed.

Implementation notes:
- Use `DndContext` at the `KanbanBoard` level wrapping all columns.
- Use `SortableContext` (strategy: `verticalListSortingStrategy`) inside each `CardList`.
- Use `useSortable` in each `KanbanCard`.
- Use `DragOverlay` to render a floating copy of the card during drag.
- On `onDragEnd`: if `over.id` is a column id, move card to that column at the bottom; if `over.id` is a card id, insert the dragged card above the target card.
- Distinguish droppable column areas from sortable card areas by tagging droppable IDs with a `column:` prefix.

---

## 9. Implementation Order

Follow these steps in sequence. Each step should be independently commit-able.

1. **Scaffold types and seed data** — create `lib/types.ts` with all TypeScript types from §5. Create `lib/seed.ts` with the full fake dataset from §6. No UI yet.

2. **Set up Zustand store** — create `lib/store.ts`. Import seed data as initial state. Implement all actions from §7. Verify with a quick `console.log` in `app/page.tsx` that the store hydrates correctly.

3. **Root layout and TopNav** — update `app/layout.tsx` to wrap children in the store provider (Zustand needs no provider, but set up any theme/font globals here). Build `TopNav` with logo, breadcrumb placeholder, `NotificationBell` (static count from store), and `UserMenu` (static "@lucas" avatar).

4. **Board list page (`/`)** — build `BoardListPage`, `BoardGrid`, and `BoardCard`. Read boards from the Zustand store. Each card links to `/boards/[id]`.

5. **Kanban board layout (`/boards/[id]`)** — build `BoardPage`, `BoardHeader`, and `KanbanBoard`. Render columns from the store filtered by `boardId`. No cards yet — columns should appear with headers and empty `CardList` areas.

6. **Column component** — build `Column`, `ColumnHeader`, and `AddCardButton`. `ColumnHeader` shows column name and the column type as a small badge (e.g. "ACTIVE" in green, "REVIEW" in blue). `AddCardButton` opens a `NewCardModal` (stub only at this step — just log to console).

7. **`AgentStatusBadge` component** — build the shared badge before adding cards, since cards depend on it. Each status variant must have a distinct colour and icon:
   - `idle` — grey circle
   - `running` — blue spinning indicator (CSS animation)
   - `blocked` — amber warning triangle
   - `failed` — red X with "retry in Ns"
   - `evaluating` — blue magnifying glass
   - `evaluation-failed` — red X with criterion count
   - `pending-approval` — amber clock
   - `completed` — green checkmark

8. **`KanbanCard` component** — build `KanbanCard`, `CardTitle`, and `CardMeta`. Read cards per column from the store. Each card shows title, `AgentStatusBadge`, and assignee. Wire click to `openCardDetail` action.

9. **Drag and drop** — wrap `KanbanBoard` in `DndContext`. Add `SortableContext` to each `CardList`. Implement `useSortable` in `KanbanCard`. Add `DragOverlay`. Wire `onDragEnd` to `moveCard` / `reorderCard` store actions.

10. **`CardDetailModal`** — build the modal that opens when `selectedCardId` is set. Implement all sub-panels conditional on card status:
    - Always: `CardDetailHeader`, `CardMetaRow`, `AcceptanceCriteriaList`, `AgentOutputPanel`
    - When `blocked`: `BlockedReasonPanel` (with `ReplyForm` and `CLIAttachCommand`)
    - When `evaluation-failed` or `pending-approval`: `EvaluationReportPanel`
    - When card is in a revision column: `RevisionContextForm`
    - When `pending-approval`: `PendingApprovalActions`
    - When `failed`: `RetrySchedulePanel`

11. **`NewCardModal`** — build the create-card form from W-01: Title, Role dropdown, GitHub fields, Description textarea, Acceptance Criteria textarea (one criterion per line, parsed into `AcceptanceCriterion[]` on submit). Wire to `createCard` store action.

12. **Attention Queue page (`/attention`)** — build `AttentionQueuePage`. Derive attention items from the store: cards with status `blocked`, `evaluation-failed` (in revision column), or `pending-approval`. Group by type. Render `AttentionItem` cards with inline action buttons wired to `approveCard` / `requestRevision` / `sendRevisionContext`. Mark items blocked for more than 1 hour as URGENT (compare `AgentRun.startedAt` against `Date.now()` using the seed timestamps or a fixed offset).

13. **`NotificationBell` count** — derive unread count from the store (count of attention-queue items). Update `TopNav` to show the live count. Wire the bell to navigate to `/attention`.

14. **Polish and responsive layout** — ensure the board scrolls horizontally on tablet widths (≥768px) without page-level horizontal scroll. Verify column widths are fixed (e.g. `w-72`). Verify `CardDetailModal` is full-height on mobile. Check all badge variants render correctly against the seed data.

---

## 10. Dependencies

All packages are already present in `package.json`. No new installs are required.

| Package | Version in package.json | Used for |
|---|---|---|
| `next` | `^14.2.29` | App Router, routing, layout |
| `react` | `^18.3.1` | UI framework |
| `react-dom` | `^18.3.1` | DOM rendering |
| `typescript` | `^5.8.3` | Type safety across all files |
| `tailwindcss` | `^3.4.17` | Utility-first styling |
| `@dnd-kit/core` | `^6.3.1` | DnD context, sensors, drag overlay |
| `@dnd-kit/sortable` | `^10.0.0` | `useSortable`, `SortableContext`, `verticalListSortingStrategy` |

One package must be added:

| Package | Recommended version | Used for |
|---|---|---|
| `zustand` | `^5.0.0` | In-memory state store |

Install with:
```bash
npm install zustand@^5.0.0
```

No other packages are needed. Do not install a Markdown renderer for this sprint — agent output in `AgentOutputPanel` renders as a `<pre>` block with whitespace preserved. Markdown rendering is a polish task for the sprint that wires real agent output.
