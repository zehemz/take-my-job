# Kobani — Frontend Design Specification

> This document is the single source of truth for visual and layout decisions. A frontend engineer must be able to implement every component described here without making any design decisions. Tailwind utility classes are the only styling mechanism — no custom CSS, no external component libraries.

---

## 1. Design Principles

**1. Status is always visible.** Every card must communicate its agent state without requiring any user interaction. The status badge is the primary visual anchor on the card face — never hidden, never truncated, always in the same position.

**2. Information density over whitespace.** The board is a work surface, not a marketing page. Columns show as many cards as possible. Padding is functional, not decorative. Empty space signals "nothing here yet", not aesthetic breathing room.

**3. Dark chrome, bright signal.** The board shell (nav, column headers, empty areas) uses a dark neutral palette so that status colors — which carry meaning — read with high contrast. Orange for blocked, green for completed, red for failed are vivid against the dark background.

**4. Human actions are unambiguous.** Any element that requires a human decision (approve, reply, send back) must be visually distinct from informational elements. Primary action buttons use a solid accent fill; destructive or rejection actions use a red outline style. The user must never be unsure whether clicking something triggers an action.

---

## 2. Color Palette

All values are Tailwind utility classes. Use these exact class names everywhere.

### 2.1 Background Colors

| Role | Tailwind Class | Notes |
|---|---|---|
| Page background | `bg-zinc-950` | Outermost shell, behind everything |
| Nav bar | `bg-zinc-900` | Top 1px border `border-b border-zinc-800` |
| Board area | `bg-zinc-950` | Horizontal scroll container |
| Column background | `bg-zinc-900` | Column container |
| Column header area | `bg-zinc-900` | Same as column, no separate band |
| Card background | `bg-zinc-800` | Default card face |
| Card hover | `bg-zinc-700` | On `hover:` |
| Card dragging | `bg-zinc-700` | Applied during drag |
| Modal/drawer overlay | `bg-black/60` | Full-screen backdrop |
| Modal/drawer panel | `bg-zinc-900` | The panel itself |
| Agent output panel | `bg-zinc-950` | Pre-formatted code-like area |
| Blocked banner background | `bg-amber-950` | Inside card detail, prominent |
| Input / textarea | `bg-zinc-950` | Reply box, context note box |
| Urgent card (attention queue) | `bg-red-950` | Cards > 1 hour in blocked/revision |

### 2.2 Text Colors

| Role | Tailwind Class |
|---|---|
| Primary text | `text-zinc-100` |
| Secondary text | `text-zinc-400` |
| Muted / metadata | `text-zinc-500` |
| Placeholder text | `placeholder-zinc-600` |
| Link / interactive | `text-indigo-400` |
| Error text | `text-red-400` |
| Inverted (on colored button) | `text-white` |

### 2.3 Status Badge Colors

Each status has a background color, a text color, and a left-side border accent (3px, using `border-l-4`). Use these exact combinations for every `StatusBadge` instance.

| Status | Badge bg | Badge text | Left border | Label |
|---|---|---|---|---|
| `idle` | `bg-zinc-700` | `text-zinc-300` | `border-l-zinc-500` | Idle |
| `running` | `bg-indigo-900` | `text-indigo-200` | `border-l-indigo-400` | Running |
| `blocked` | `bg-amber-900` | `text-amber-200` | `border-l-amber-400` | Blocked |
| `evaluating` | `bg-sky-900` | `text-sky-200` | `border-l-sky-400` | Evaluating |
| `evaluation-failed` | `bg-rose-900` | `text-rose-200` | `border-l-rose-400` | Eval Failed |
| `pending-approval` | `bg-violet-900` | `text-violet-200` | `border-l-violet-400` | Pending Approval |
| `completed` | `bg-emerald-900` | `text-emerald-200` | `border-l-emerald-400` | Completed |
| `failed` | `bg-red-900` | `text-red-200` | `border-l-red-400` | Failed |

### 2.4 Border, Shadow, and Interactive States

| Role | Tailwind Class |
|---|---|
| Column border | `border border-zinc-800` |
| Card border (default) | `border border-zinc-700` |
| Card border (hover) | `hover:border-zinc-500` |
| Card border (dragging) | `border-indigo-500` |
| Drop target column highlight | `ring-2 ring-indigo-500 ring-inset` |
| Modal panel shadow | `shadow-2xl` |
| Input border default | `border border-zinc-700` |
| Input border focused | `focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500` |
| Divider | `border-t border-zinc-800` |
| Card shadow (default) | `shadow-sm` |
| Card shadow (dragging) | `shadow-2xl` |
| Urgent card border | `border border-red-500` |

### 2.5 Button Colors

| Variant | Classes |
|---|---|
| Primary action (Approve, Send) | `bg-indigo-600 hover:bg-indigo-500 text-white` |
| Destructive / reject | `border border-red-500 text-red-400 hover:bg-red-500 hover:text-white bg-transparent` |
| Secondary / cancel | `bg-zinc-700 hover:bg-zinc-600 text-zinc-200` |
| Ghost / subtle | `text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 bg-transparent` |

All buttons: `rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer`.

---

## 3. Typography

Use the Next.js default font stack (system sans-serif). No custom font import is required for the sprint-1 frontend.

| Element | Classes |
|---|---|
| Page / brand name ("Kobani") | `text-lg font-semibold text-zinc-100 tracking-tight` |
| Board title | `text-base font-medium text-zinc-200` |
| Column header name | `text-xs font-semibold text-zinc-400 uppercase tracking-widest` |
| Card count badge | `text-xs font-medium text-zinc-500` |
| Card title | `text-sm font-medium text-zinc-100 leading-snug` |
| Card description (modal) | `text-sm text-zinc-300 leading-relaxed` |
| Status badge label | `text-xs font-semibold` |
| Acceptance criterion text | `text-sm text-zinc-300` |
| Evidence text (below criterion) | `text-xs text-zinc-500 font-mono` |
| Agent output (pre-formatted) | `text-xs font-mono text-zinc-300 leading-relaxed` |
| Metadata (time-in-column, etc.) | `text-xs text-zinc-500` |
| Section label / divider text | `text-xs font-semibold text-zinc-500 uppercase tracking-wider` |
| Blocked reason text | `text-sm text-amber-200 leading-relaxed` |
| Input / textarea text | `text-sm text-zinc-100` |
| Button text (primary) | `text-sm font-medium` |
| Nav items (bell, dots) | `text-zinc-400 hover:text-zinc-100` |
| Notification count badge | `text-xs font-bold text-white` |

---

## 4. Spacing and Layout

### 4.1 Page Layout

```
AppShell (full viewport height, flex-col)
  ├── Nav bar: h-12, px-4, flex items-center
  └── Board area: flex-1 overflow-hidden
        └── Board: flex-1 overflow-x-auto overflow-y-hidden
```

- Page background: `bg-zinc-950 min-h-screen`
- Nav height: `h-12` (48px)
- Board area fills remaining height: `flex-1 overflow-hidden`
- Board horizontal padding: `px-4 py-4`
- Column gap: `gap-3` (12px)

### 4.2 Column Dimensions

- Column width: **fixed `w-72`** (288px) — do not use flex-grow
- Column min-height: `min-h-0` (lets flex parent control height)
- Column max-height: fills the board area height — achieved via `flex flex-col` on the column inside a `h-full` parent
- Column internal layout: `flex flex-col` so the card list takes remaining height
- Card list: `flex-1 overflow-y-auto` — vertical scroll within the column
- Card gap: `gap-2` (8px)
- Column header padding: `px-3 py-2.5`
- Column body padding: `px-2 pb-2`
- "Add card" button: `mt-auto px-3 py-2` at bottom of column

### 4.3 Card Dimensions

- Card padding: `p-3`
- Card border-radius: `rounded-lg`
- Card is not fixed height — it grows with content
- Maximum card title lines: 2 (use `line-clamp-2` via `overflow-hidden`)
- Minimum card height: implicitly ~72px from content

### 4.4 Scrolling Behavior

- **Board**: horizontal scroll, no vertical scroll. Class on the board container: `overflow-x-auto overflow-y-hidden flex flex-row flex-nowrap`
- **Column card list**: vertical scroll only. Class: `overflow-y-auto overflow-x-hidden`
- **Agent output panel (modal)**: vertical scroll only. Class: `overflow-y-auto max-h-64`
- **Attention Queue Drawer**: vertical scroll. Class: `overflow-y-auto`
- **Card Detail Modal**: the modal panel is `overflow-y-auto max-h-[90vh]`

### 4.5 Modal / Drawer Dimensions

- Card Detail Modal: centered, `w-full max-w-2xl`, full-height capable: `max-h-[90vh]`, `rounded-xl`
- Attention Queue Drawer: right-side drawer, `w-full max-w-md`, full viewport height, slides in from right
- Overlay: `fixed inset-0` covering the entire viewport

---

## 5. Component Specifications

---

### 5.1 `AppShell`

**Purpose:** Persistent top navigation and the page layout wrapper.

**Layout:** `flex flex-col min-h-screen bg-zinc-950`

**Nav bar container:**
```
<nav class="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-3 shrink-0">
```

**Nav bar internal layout (left to right):**
1. Brand + breadcrumb (left, flex-1):
   - `"Kobani"` — `text-lg font-semibold text-zinc-100 tracking-tight`
   - Separator: `text-zinc-600 mx-1` — character `/`
   - Board name: `text-base font-medium text-zinc-400`
2. Right cluster (right, `flex items-center gap-3`):
   - Notification bell: `relative` wrapper; icon `w-5 h-5 text-zinc-400 hover:text-zinc-100 cursor-pointer transition-colors`; unread badge: `absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center`
   - User avatar: `w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white cursor-pointer`
   - Overflow menu (`···`): `text-zinc-400 hover:text-zinc-100 cursor-pointer px-1`

**Below nav:** `<main class="flex-1 overflow-hidden">` — contains the Board.

**Implementation notes:**
- The board name in the breadcrumb is dynamic; it reads from the current board's `name` field.
- The notification bell badge is hidden when count is 0; render it conditionally.
- The avatar shows the user's initials (first letter of first and last name).

---

### 5.2 `Board`

**Purpose:** Horizontal scrollable container of all columns for a single board.

**Container:**
```
<div class="flex flex-row flex-nowrap gap-3 px-4 py-4 overflow-x-auto overflow-y-hidden h-full items-start">
```

**Visual states:**
- Default: no special styling on the container itself
- While any column is a valid drop target: individual column receives the drop target ring (see §6)

**Implementation notes:**
- `h-full` on the board container ensures columns extend to fill the vertical space
- Use `@dnd-kit/core` `<DndContext>` wrapping the entire Board
- Columns are rendered in their `position` order (ascending)
- No empty-state illustration needed for sprint 1 — empty columns already communicate empty state via the "Add card" button

---

### 5.3 `Column`

**Purpose:** A named vertical swim lane that holds an ordered list of cards.

**Outer container (fixed-width, full-height flex column):**
```
<div class="w-72 shrink-0 flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl h-full">
```

**Header:**
```
<div class="flex items-center justify-between px-3 py-2.5 shrink-0">
  <span class="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{column.name}</span>
  <span class="text-xs font-medium text-zinc-500 bg-zinc-800 rounded-full px-2 py-0.5">{cards.length}</span>
</div>
```

**Divider below header:** `<div class="border-t border-zinc-800 mx-0" />`

**Card list (scrollable):**
```
<div class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-2 px-2 py-2">
  {/* Cards rendered here */}
</div>
```

**"Add card" button:**
```
<div class="px-2 pb-2 shrink-0">
  <button class="w-full text-left text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg px-3 py-2 transition-colors duration-150 cursor-pointer">
    + Add card
  </button>
</div>
```

**Drop target state:** When a card is dragged over this column, add `ring-2 ring-indigo-500 ring-inset` to the outer container. Remove when drag leaves.

**Implementation notes:**
- Use `@dnd-kit/sortable` `<SortableContext>` inside the card list for within-column reordering
- The column `position` field governs render order; do not sort by name
- Column header card count badge updates reactively as cards move in/out

---

### 5.4 `Card`

**Purpose:** The card face — the unit of work visible on the board. Clicking opens `CardDetailModal`.

**Container:**
```
<div class="bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md transition-all duration-150 select-none">
```

**Internal layout (flex column, gap-2):**
```
<div class="flex flex-col gap-2">
  <!-- Row 1: Title -->
  <p class="text-sm font-medium text-zinc-100 leading-snug line-clamp-2">{card.title}</p>

  <!-- Row 2: Status badge -->
  <StatusBadge status={card.agentStatus} />

  <!-- Row 3: Footer — assignee + time-in-column -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-1.5">
      <!-- Assignee avatar -->
      <div class="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
        {initials}
      </div>
      <span class="text-xs text-zinc-500">@{assignee.username}</span>
    </div>
    <!-- Time in column -->
    <span class="text-xs text-zinc-500">{timeInColumn}</span>
  </div>
</div>
```

**Visual states:**

| State | Classes applied to container |
|---|---|
| Default | `bg-zinc-800 border-zinc-700 shadow-sm` |
| Hovered | `bg-zinc-700 border-zinc-500 shadow-md` |
| Dragging (active drag) | `bg-zinc-700 border-indigo-500 shadow-2xl opacity-80 rotate-1 scale-105` |
| Drag placeholder (slot left behind) | `bg-zinc-800/40 border-dashed border-zinc-600 opacity-50` |

**Implementation notes:**
- `timeInColumn` is displayed as a relative string: `"3h"`, `"2d"`, `"just now"`. Compute from `card.movedToColumnAt` at render time.
- Assignee avatar: if no assignee, render nothing in that slot — do not show a placeholder avatar.
- The card does not show description text on the card face. Title + status badge + assignee + time is the complete surface.
- `line-clamp-2` requires `overflow-hidden` — include that in the `<p>` element.

---

### 5.5 `StatusBadge`

**Purpose:** A pill badge showing the agent's current status for a card.

**Container structure:**
```
<span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold border-l-4 {bgColor} {textColor} {borderColor}">
  {icon}
  {label}
</span>
```

**Per-status spec:**

| Status | bg | text | border-l | Icon | Label |
|---|---|---|---|---|---|
| `idle` | `bg-zinc-700` | `text-zinc-300` | `border-l-zinc-500` | `○` (circle outline, 10px) | Idle |
| `running` | `bg-indigo-900` | `text-indigo-200` | `border-l-indigo-400` | Animated spinner (see below) | Running |
| `blocked` | `bg-amber-900` | `text-amber-200` | `border-l-amber-400` | `⚠` | Blocked |
| `evaluating` | `bg-sky-900` | `text-sky-200` | `border-l-sky-400` | Animated spinner | Evaluating |
| `evaluation-failed` | `bg-rose-900` | `text-rose-200` | `border-l-rose-400` | `✗` | Eval Failed |
| `pending-approval` | `bg-violet-900` | `text-violet-200` | `border-l-violet-400` | `⏳` | Pending Approval |
| `completed` | `bg-emerald-900` | `text-emerald-200` | `border-l-emerald-400` | `✓` | Completed |
| `failed` | `bg-red-900` | `text-red-200` | `border-l-red-400` | `✗` | Failed |

**Spinner (for `running` and `evaluating`):** A 10×10px inline SVG circle with `animate-spin`, `stroke-current`, `fill-none`. Class: `w-2.5 h-2.5 animate-spin`.

**"Live" pulse dot (for `running` and `evaluating` on the `AgentOutputPanel`):** `w-2 h-2 rounded-full bg-indigo-400 animate-pulse` — rendered adjacent to the "Agent Output" section heading, not inside the badge itself.

**Implementation notes:**
- `StatusBadge` is a pure display component. It receives a `status` prop of the union type and renders deterministically.
- Do not conditionally show/hide text — the label always appears.
- The `border-l-4` left accent requires the badge container to have `border-l-4` and the specific `border-l-{color}` class. Do not use `border` shorthand, as that would add borders on all sides.

---

### 5.6 `CardDetailModal`

**Purpose:** Full-screen overlay showing all card details, agent output, acceptance criteria, and action buttons. Opened by clicking any card on the board.

**Overlay:**
```
<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
```

**Panel:**
```
<div class="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
```

**Panel internal sections (top to bottom, each separated by `border-t border-zinc-800`):**

**Header:**
```
<div class="flex items-start justify-between px-6 py-4 shrink-0">
  <div class="flex flex-col gap-1.5">
    <h2 class="text-base font-semibold text-zinc-100">{card.title}</h2>
    <div class="flex items-center gap-2">
      <StatusBadge status={card.agentStatus} />
      <span class="text-xs text-zinc-500">{timeInColumn} in {column.name}</span>
    </div>
  </div>
  <!-- Close button -->
  <button class="text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded cursor-pointer">✕</button>
</div>
```

**Metadata row (role, attempt, started):**
```
<div class="px-6 py-3 flex items-center gap-4 text-xs text-zinc-500 shrink-0">
  <span>Role: <span class="text-zinc-300">{role}</span></span>
  <span>Attempt: <span class="text-zinc-300">{attempt} / 5</span></span>
  <span>Started: <span class="text-zinc-300">{relativeTime}</span></span>
</div>
```
Only render this row when an AgentRun exists for the card.

**BlockedBanner:** Rendered here when `status === 'blocked'` (see §5.9).

**Acceptance Criteria section:**
```
<div class="px-6 py-4">
  <p class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Acceptance Criteria</p>
  <AcceptanceCriteriaList criteria={card.criteria} />
</div>
```

**Agent Output section:**
```
<div class="px-6 py-4 flex-1">
  <div class="flex items-center gap-2 mb-3">
    <p class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Agent Output</p>
    {isLive && <span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
  </div>
  <AgentOutputPanel output={agentRun.output} isLive={isLive} />
</div>
```

**Action buttons (bottom, only when applicable):**
```
<div class="px-6 py-4 flex items-center justify-between shrink-0 border-t border-zinc-800">
  <!-- Left: destructive -->
  <button class="border border-red-500 text-red-400 hover:bg-red-500 hover:text-white bg-transparent rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer">
    ✗ Request Revision
  </button>
  <!-- Right: primary -->
  <button class="bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer">
    ✓ Approve &amp; Close
  </button>
</div>
```
Only render action buttons when `status === 'pending-approval'`. For `status === 'evaluation-failed'` in the Revision column, render a single `"Send back to In Progress"` primary button aligned right, with the optional context note textarea above it (see W-07).

**Closing behavior:** Clicking the overlay background or the `✕` button closes the modal. Implement with `onClick` on the overlay div and `stopPropagation` on the panel.

**Implementation notes:**
- The modal mounts into a React portal at `document.body`.
- When open, add `overflow-hidden` to `<body>` to prevent background scroll.
- The "Previous work by Backend Engineer" collapsed section (W-03) renders as a `<details>` element: `<details class="mt-2"><summary class="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">Previous work — click to expand</summary>...</details>`

---

### 5.7 `AgentOutputPanel`

**Purpose:** Scrollable pre-formatted agent output. Shows streamed text; maintains scroll position at the bottom when new content arrives (auto-scroll while live, locked after user scrolls up).

**Container:**
```
<div class="bg-zinc-950 border border-zinc-800 rounded-lg overflow-y-auto max-h-64 p-3">
  <pre class="text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap break-words m-0">
    {output}
  </pre>
</div>
```

**"Live" cursor:** When `isLive === true`, append a blinking cursor character after the last character of output:
```
<span class="animate-pulse text-indigo-400">▌</span>
```

**Auto-scroll behavior:**
- On mount and when `output` changes: if the user has not manually scrolled up (track with a `userScrolled` ref), programmatically scroll to the bottom using `scrollIntoView` or `scrollTop = scrollHeight`.
- If the user scrolls up: set `userScrolled = true`, stop auto-scroll.
- When `isLive` becomes `false`: re-enable auto-scroll reset.

**Empty state** (no output yet):
```
<div class="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-center max-h-64">
  <span class="text-xs text-zinc-600">Waiting for agent output...</span>
</div>
```

---

### 5.8 `AcceptanceCriteriaList`

**Purpose:** Checklist of acceptance criteria. Shows unchecked (pending), pass, or fail state per criterion. When evaluated, shows evidence text below each item.

**Container:** `<ul class="flex flex-col gap-2 list-none m-0 p-0">`

**Each criterion item:**
```
<li class="flex flex-col gap-0.5">
  <div class="flex items-start gap-2">
    <!-- Status icon -->
    <span class="mt-0.5 shrink-0 {iconColor}">{icon}</span>
    <!-- Criterion text -->
    <span class="text-sm text-zinc-300">{criterion.text}</span>
  </div>
  <!-- Evidence (only when evaluated) -->
  {criterion.evidence && (
    <p class="ml-6 text-xs text-zinc-500 font-mono">{criterion.evidence}</p>
  )}
</li>
```

**Icon and color per state:**

| State | Icon char | Icon color class |
|---|---|---|
| `pending` (no evaluation yet) | `◻` | `text-zinc-600` |
| `checking` (evaluation in progress) | `○` animated spinner | `text-sky-400` |
| `passed` | `✅` | `text-emerald-400` |
| `failed` | `✗` | `text-rose-400` |

**Implementation notes:**
- During evaluation (`status === 'evaluating'`), all criteria show the `checking` spinner until the evaluation agent emits a verdict for each. Update criterion state individually as the stream resolves them.
- For the sprint-1 fake data, criteria state is hardcoded per card — no streaming needed.

---

### 5.9 `BlockedBanner`

**Purpose:** Prominent in-card-detail section shown when `status === 'blocked'`. Shows the agent's stated reason, a reply textarea, and the CLI attach command.

**Container (inside `CardDetailModal`, above Acceptance Criteria):**
```
<div class="mx-6 my-4 bg-amber-950 border border-amber-800 rounded-lg p-4 flex flex-col gap-4">
```

**Header:**
```
<div class="flex items-center gap-2">
  <span class="text-amber-400 text-sm">⚠</span>
  <span class="text-sm font-semibold text-amber-200">Agent needs your input</span>
</div>
```

**Blocked reason (full text, no truncation):**
```
<p class="text-sm text-amber-200 leading-relaxed">{blockedReason}</p>
```

**Option A — Reply input:**
```
<div class="flex flex-col gap-2">
  <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Option A — Reply here</p>
  <textarea
    class="w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors"
    rows={3}
    placeholder="Reply to the agent..."
  />
  <button class="self-end bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer">
    Send to agent
  </button>
</div>
```

**Option B — CLI command:**
```
<div class="flex flex-col gap-2">
  <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Option B — Connect via CLI</p>
  <div class="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
    <code class="flex-1 text-xs font-mono text-zinc-300">ant sessions connect {sessionId}</code>
    <button class="text-xs text-indigo-400 hover:text-indigo-200 transition-colors cursor-pointer shrink-0">Copy</button>
  </div>
</div>
```

**Implementation notes:**
- The `Copy` button writes the CLI command string to `navigator.clipboard.writeText(...)`.
- After a successful copy, change button label to `"Copied!"` for 2 seconds, then revert.
- This entire banner is conditionally rendered — only when `card.agentStatus === 'blocked'`.

---

### 5.10 `AttentionQueueDrawer`

**Purpose:** Right-side drawer listing all blocked/revision/pending-approval cards requiring human action. Accessible from the notification bell in the nav.

**Overlay (click to dismiss):**
```
<div class="fixed inset-0 bg-black/40 z-40" onClick={close} />
```

**Drawer panel:**
```
<aside class="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 flex flex-col">
```

**Drawer header:**
```
<div class="h-12 flex items-center justify-between px-4 border-b border-zinc-800 shrink-0">
  <span class="text-sm font-semibold text-zinc-100">Needs Attention</span>
  <div class="flex items-center gap-3">
    <span class="text-xs text-zinc-500">{totalCount} items</span>
    <button class="text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer">✕</button>
  </div>
</div>
```

**Scrollable content:**
```
<div class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
  {/* Grouped sections: Blocked, Revision Needed, Pending Approval */}
</div>
```

**Section group header:**
```
<p class="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-1">{groupLabel}</p>
```

**Each attention item card:**
```
<div class="bg-zinc-800 border {borderClass} rounded-lg p-4 flex flex-col gap-3">
  <!-- Header row: state badge + age + URGENT tag -->
  <div class="flex items-center justify-between">
    <StatusBadge status={item.status} />
    <div class="flex items-center gap-2">
      {isUrgent && (
        <span class="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-1.5 py-0.5">URGENT</span>
      )}
      <span class="text-xs text-zinc-500">{age} ago</span>
    </div>
  </div>

  <!-- Card title + board/column path -->
  <div>
    <p class="text-sm font-medium text-zinc-100">{card.title}</p>
    <p class="text-xs text-zinc-500 mt-0.5">{board.name} / {column.name}</p>
  </div>

  <!-- Reason / summary -->
  <p class="text-sm text-zinc-400 leading-relaxed">{summary}</p>

  <!-- Action buttons -->
  <div class="flex items-center gap-2 justify-end">
    {/* Per-status action buttons — see below */}
  </div>
</div>
```

**Border class per state:**

| State | Border class |
|---|---|
| `blocked` (non-urgent) | `border-amber-800` |
| `blocked` (urgent, > 1 hour) | `border-red-500` and `bg-red-950` replaces `bg-zinc-800` |
| `evaluation-failed` / revision | `border-rose-800` |
| `pending-approval` | `border-violet-800` |

**Action buttons per state:**

| State | Buttons |
|---|---|
| `blocked` | `[ Reply ]` (primary) + `[ Connect via CLI ]` (secondary) |
| `evaluation-failed` / revision | `[ View evaluation report ]` (secondary) |
| `pending-approval` | `[ ✗ Request Revision ]` (destructive) + `[ ✓ Approve ]` (primary) |

**Animation:** The drawer slides in from the right. Use a CSS transition on the drawer panel's `translate-x`:
- Closed: `translate-x-full`
- Open: `translate-x-0`
- Transition: `transition-transform duration-300 ease-in-out`

Implement with a wrapper: `<aside class="... transform transition-transform duration-300 ease-in-out {isOpen ? 'translate-x-0' : 'translate-x-full'}">`.

**Implementation notes:**
- Clicking any item in the drawer opens the `CardDetailModal` for that card (the drawer stays open behind the modal).
- The drawer is triggered by clicking the notification bell in the nav.
- For sprint-1 fake data, clicking "Reply" or "Approve" from the drawer can open the `CardDetailModal` rather than taking inline action.

---

## 6. Drag and Drop Visual States

Uses `@dnd-kit/core` and `@dnd-kit/sortable`. The following visual transitions must be implemented exactly.

### 6.1 Card Being Dragged

When a card is picked up (`isDragging === true` from `useSortable`):
- Apply to the dragged card element: `opacity-80 rotate-1 scale-105 shadow-2xl border-indigo-500 bg-zinc-700 cursor-grabbing z-50`
- The rotation (`rotate-1` = 1deg) gives a "lifted" feel without being cartoonish
- The original slot left behind in the column renders as a ghost placeholder:
  ```
  <div class="bg-zinc-800/30 border border-dashed border-zinc-700 rounded-lg" style={{height: originalCardHeight}} />
  ```
  Height should match the original card height to prevent column layout shift.

### 6.2 Valid Drop Target Column

When a dragged card is hovering over a column (`isOver === true` from `useDroppable`):
- Add to the column outer container: `ring-2 ring-indigo-500 ring-inset`
- Add to the column background: transition from `bg-zinc-900` to `bg-zinc-900` (no fill change) — only the ring changes
- If the column card list is empty and hovered: show a dashed insertion indicator:
  ```
  <div class="border-2 border-dashed border-indigo-700 rounded-lg h-16 flex items-center justify-center">
    <span class="text-xs text-indigo-600">Drop here</span>
  </div>
  ```

### 6.3 Card Dropped (Snap Animation)

When a card is released and the drop completes:
1. The drag overlay disappears immediately
2. The card animates to its new position using `@dnd-kit/sortable`'s built-in `transition` property: `{ duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }`
3. The column ring (`ring-2 ring-indigo-500`) is removed immediately on drop
4. No custom success flash — the card settles smoothly into position

### 6.4 Invalid Drop (Reverted)

If a drop is cancelled or reverted (card moved back to original position):
- The card snaps back to its origin column using the same transition (200ms ease-out)
- No error visual is shown on the card — the revert itself is the signal

---

## 7. Responsive Behavior (≥768px — Tablet, PRD X.2)

The PRD requires the board to be usable on tablet-sized screens (≥768px) with no horizontal scrolling on a standard iPad viewport (768px wide).

**Implementation strategy:** At tablet breakpoint, switch from a multi-column horizontal scroll board to a single-column stacked layout.

### 7.1 Breakpoint Logic

- **≥1024px (desktop):** Full horizontal board with all columns visible side-by-side. This is the primary layout described in §4.
- **768px–1023px (tablet):** Columns are displayed as a vertically stacked accordion. No horizontal scroll.
- **< 768px:** Out of scope per PRD. The board can overflow — no specific accommodation needed.

### 7.2 Tablet Column Layout (768px–1023px)

Replace the horizontal flex board with:
```
<div class="flex flex-col gap-3 px-3 py-3 overflow-y-auto">
```

Each column becomes full-width:
```
<div class="w-full bg-zinc-900 border border-zinc-800 rounded-xl">
```

Columns are collapsible at tablet width. The column header becomes a toggle:
- Collapsed: shows column name, card count badge, and a `▸` chevron — card list is hidden
- Expanded: shows the full card list — use a `▾` chevron

The "In Progress" and "Review" columns default to expanded at tablet width. "Backlog" and "Done" default to collapsed.

Column header at tablet (clickable):
```
<button class="w-full flex items-center justify-between px-3 py-3 text-left cursor-pointer hover:bg-zinc-800 rounded-t-xl transition-colors">
  <div class="flex items-center gap-2">
    <span class="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{column.name}</span>
    <span class="text-xs text-zinc-500 bg-zinc-800 rounded-full px-2 py-0.5">{cards.length}</span>
  </div>
  <span class="text-zinc-500 text-xs">{isExpanded ? '▾' : '▸'}</span>
</button>
```

The card list inside the column uses `max-h-96 overflow-y-auto` at tablet width to prevent excessively tall columns.

### 7.3 Navigation at Tablet

The nav bar retains its full layout at 768px — no hamburger menu. The board name breadcrumb truncates with `truncate max-w-[140px]` if needed.

The `AttentionQueueDrawer` remains a right-side drawer at tablet width, using its full `max-w-md` width (which is 448px — fits within 768px viewport when the board is behind the overlay).

### 7.4 `CardDetailModal` at Tablet

The modal at tablet width is full-width:
- Change `max-w-2xl` to `max-w-full mx-3` at `md:` breakpoint or below
- `max-h-[95vh]`

Use Tailwind responsive prefix `md:` for desktop overrides where needed:
```
<div class="bg-zinc-900 ... w-full mx-3 max-h-[95vh] md:max-w-2xl md:mx-auto md:max-h-[90vh]">
```

---

## 8. Fake Data Visual Goal

The fake seed data must make all status badge states visible at a glance when the board first loads. This is the reference state for the board on first render.

### 8.1 Columns (left to right)

| Column | Type | Cards |
|---|---|---|
| Backlog | Inactive | 2 cards |
| In Progress | Active | 3 cards |
| Review | Review | 1 card |
| Revision Needed | Revision | 1 card |
| Done | Terminal | 2 cards |

### 8.2 Cards by Column and Status

**Backlog (2 cards):**
1. "API rate limit documentation" — `idle`, assigned @lucas
2. "Onboarding email sequence" — `idle`, assigned @sarah

**In Progress (3 cards):**
1. "Auth flow redesign" — `running`, assigned @lucas, started 4 min ago — this card is the "hero" example from the wireframes
2. "Database migration script" — `blocked`, assigned @sarah, blocked 1h 15m ago (qualifies as URGENT in attention queue)
3. "Payment webhook handler" — `failed` (attempt 2/5, retrying in 38s), assigned @lucas

**Review (1 card):**
1. "Search indexing service" — `evaluating`, assigned @sarah, evaluation started 2 min ago

**Revision Needed (1 card):**
1. "Onboarding copy update" — `evaluation-failed` (2 of 3 criteria failed), assigned @lucas

**Done (2 cards):**
1. "User profile API" — `completed`, assigned @sarah, approved 2 days ago
2. "CI pipeline setup" — `completed`, assigned @lucas, approved 5 days ago

There is also one card in Review with `pending-approval` status — add it as a second card in the Review column:
- "Checkout flow refactor" — `pending-approval`, assigned @lucas, evaluation passed 8 min ago, awaiting sign-off

### 8.3 Attention Queue State

When the notification bell is clicked, the drawer shows 3 items:

1. **Blocked — URGENT:** "Database migration script" / Sprint 12 Board / In Progress — blocked 1h 15m ago
2. **Revision Needed:** "Onboarding copy update" / Content Pipeline / Revision Needed — 22 min ago
3. **Pending Approval:** "Checkout flow refactor" / Sprint 12 Board / Review — 8 min ago

The notification bell badge shows `3`.

### 8.4 Visual Checkpoint

After the fake data loads, an engineer reviewing the board should see all 8 status badge variants in use across visible cards without opening any modal:

- `idle` — 2× in Backlog
- `running` — 1× in In Progress
- `blocked` — 1× in In Progress
- `failed` — 1× in In Progress
- `evaluating` — 1× in Review
- `pending-approval` — 1× in Review
- `evaluation-failed` — 1× in Revision Needed
- `completed` — 2× in Done

This validates the color palette and badge spec in a single viewport.

---

## Appendix A — Tailwind Class Quick Reference

Frequently combined classes that appear throughout components:

| Pattern | Classes |
|---|---|
| Section divider heading | `text-xs font-semibold text-zinc-500 uppercase tracking-wider` |
| Code/mono snippet inline | `font-mono text-xs text-zinc-300 bg-zinc-950 px-1.5 py-0.5 rounded` |
| Subtle full-width button | `w-full text-left text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg px-3 py-2 transition-colors duration-150 cursor-pointer` |
| Small avatar | `w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white shrink-0` |
| Standard avatar (nav) | `w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white` |
| Close button | `text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded cursor-pointer` |
| Thin horizontal rule | `border-t border-zinc-800` |
| Rounded badge (count) | `text-xs font-medium text-zinc-500 bg-zinc-800 rounded-full px-2 py-0.5` |
