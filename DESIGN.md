# Kobani — Frontend Design Spec

> This document is the single source of truth for visual decisions. The Frontend Engineer makes zero design decisions — every Tailwind class, spacing value, and interaction state is specified here.

---

## 1. Design Principles

1. **Dark canvas, bright signal.** The board is a dark neutral surface. Color is reserved for status and urgency — never decoration. A blocked card must be visually louder than a running card without any surrounding context.

2. **Everything in its place.** Spacing and sizing are systematic. Column widths never vary. Card padding never changes. The grid is rigid so that the eye can learn where information lives and stop searching.

3. **Motion serves meaning.** Transitions only occur when they communicate something: a card being dragged, a cursor blinking, a drawer sliding in. There are no ambient animations.

4. **Human attention is scarce.** Cards that require a human decision escalate their own visual weight automatically — amber for blocked, red for urgent, a dedicated drawer to collect all items needing action. The board should surface what demands the human without requiring them to read every card.

---

## 2. Color Palette

All colors are Tailwind classes. No arbitrary values except where explicitly marked.

### 2.1 Backgrounds

| Role | Class |
|---|---|
| Page / outermost canvas | `bg-zinc-950` |
| Top navigation bar | `bg-zinc-900 border-b border-zinc-800` |
| Column background | `bg-zinc-900` |
| Card surface (default) | `bg-zinc-800` |
| Card surface (hover) | `bg-zinc-700` |
| Modal backdrop scrim | `bg-black/60` |
| Modal surface | `bg-zinc-900` |
| Agent output panel | `bg-zinc-950` |
| Input / textarea | `bg-zinc-800 border border-zinc-700` |
| Input / textarea (focus) | `bg-zinc-800 border border-zinc-600 ring-1 ring-zinc-500` |
| Drawer surface | `bg-zinc-900` |
| Drawer backdrop scrim | `bg-black/40` |
| Tooltip | `bg-zinc-700` |

### 2.2 Text

| Role | Class |
|---|---|
| Primary text (headings, card titles) | `text-zinc-100` |
| Secondary text (descriptions, metadata) | `text-zinc-400` |
| Tertiary / placeholder text | `text-zinc-600` |
| Link / interactive text | `text-sky-400 hover:text-sky-300` |
| Destructive text | `text-red-400` |
| Monospace / evidence text | `text-zinc-300 font-mono` |
| Disabled text | `text-zinc-600` |

### 2.3 Status Badge Colors

Each status uses a background, a text color, and an icon character (no external icon library required at this stage).

| Status | Background | Text | Border | Icon char |
|---|---|---|---|---|
| `idle` | `bg-zinc-800` | `text-zinc-400` | `border border-zinc-600` | `○` |
| `running` | `bg-sky-900/60` | `text-sky-300` | `border border-sky-700` | `⟳` |
| `blocked` | `bg-amber-900/60` | `text-amber-300` | `border border-amber-600` | `⚠` |
| `evaluating` | `bg-violet-900/60` | `text-violet-300` | `border border-violet-700` | `◎` |
| `evaluation-failed` | `bg-red-900/60` | `text-red-300` | `border border-red-700` | `✗` |
| `pending-approval` | `bg-yellow-900/60` | `text-yellow-300` | `border border-yellow-600` | `⏳` |
| `completed` | `bg-emerald-900/60` | `text-emerald-300` | `border border-emerald-700` | `✓` |
| `failed` | `bg-red-900/60` | `text-red-400` | `border border-red-800` | `✗` |

> Note: `evaluation-failed` and `failed` share the same palette but carry different labels ("Eval Failed" vs "Failed"). The icon character `✗` is the same. The distinction is in the label text only.

### 2.4 Borders

| Role | Class |
|---|---|
| Default card border | `border border-zinc-700` |
| Column separator / divider | `border-zinc-800` |
| Modal border | `border border-zinc-700` |
| Input border | `border border-zinc-700` |
| Input border (focus) | `border-zinc-600` |
| Blocked card accent border | `border-l-4 border-l-amber-500` |
| Evaluation-failed card accent border | `border-l-4 border-l-red-500` |
| Pending-approval card accent border | `border-l-4 border-l-yellow-500` |
| Urgent escalation border | `border border-red-600 ring-1 ring-red-700` |

### 2.5 Shadows

| Role | Class |
|---|---|
| Card default | `shadow-sm shadow-black/40` |
| Card hover | `shadow-md shadow-black/60` |
| Card dragging | `shadow-2xl shadow-black/80` |
| Modal | `shadow-2xl shadow-black/80` |
| Drawer | `shadow-2xl shadow-black/60` |

### 2.6 Hover and Active States

| Element | Default | Hover | Active / Pressed |
|---|---|---|---|
| Card | `bg-zinc-800 border-zinc-700` | `bg-zinc-700 border-zinc-600` | `bg-zinc-700 scale-[0.99]` |
| "Add card" button | `text-zinc-500` | `text-zinc-300 bg-zinc-800` | `text-zinc-200 bg-zinc-700` |
| Primary button (Approve, Send) | `bg-sky-600 text-white` | `bg-sky-500` | `bg-sky-700` |
| Destructive button (Request revision) | `bg-transparent text-red-400 border border-red-700` | `bg-red-900/40 text-red-300` | `bg-red-900/60` |
| Ghost button (Cancel, secondary) | `bg-transparent text-zinc-400` | `bg-zinc-800 text-zinc-300` | `bg-zinc-700` |
| Nav icon button | `text-zinc-400` | `text-zinc-200 bg-zinc-800` | `text-zinc-100` |
| Column header drag handle | `text-zinc-600` | `text-zinc-400` | — |

---

## 3. Typography

All type is set in the system sans-serif stack via Tailwind's default `font-sans`. Evidence and agent output use `font-mono`.

| Element | Classes |
|---|---|
| App name / logo | `text-lg font-semibold tracking-tight text-zinc-100` |
| Page / view title (Needs Attention, etc.) | `text-xl font-semibold text-zinc-100` |
| Board name in nav | `text-sm font-medium text-zinc-300` |
| Column header name | `text-xs font-semibold uppercase tracking-widest text-zinc-400` |
| Column card count | `text-xs font-medium text-zinc-500 tabular-nums` |
| Card title | `text-sm font-medium text-zinc-100 leading-snug` |
| Card description (in modal) | `text-sm text-zinc-400 leading-relaxed` |
| Badge label | `text-xs font-medium` (color from status table) |
| Badge icon char | `text-xs` (same color as label) |
| Metadata (role, time, attempt) | `text-xs text-zinc-500` |
| Time-in-column label | `text-xs text-zinc-500 tabular-nums` |
| Section label inside modal | `text-xs font-semibold uppercase tracking-wider text-zinc-500` |
| Acceptance criterion text | `text-sm text-zinc-300` |
| Evidence text | `text-xs font-mono text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded` |
| Agent output text | `text-sm font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap` |
| Blocked reason quote | `text-sm text-amber-200 leading-relaxed` |
| Input / textarea text | `text-sm text-zinc-100 placeholder:text-zinc-600` |
| CLI command text | `text-xs font-mono text-zinc-300` |
| Notification banner text | `text-sm text-zinc-100` |
| Tooltip text | `text-xs text-zinc-300` |

---

## 4. Spacing and Layout

### 4.1 Page

| Role | Value |
|---|---|
| Page horizontal padding | `px-6` |
| Page top padding (below nav) | `pt-6` |
| Page bottom padding | `pb-6` |
| Top nav height | `h-12` |
| Top nav horizontal padding | `px-4` |

### 4.2 Board

| Role | Value |
|---|---|
| Board container | `flex flex-row items-start gap-4 overflow-x-auto pb-6 min-h-0` |
| Board horizontal scroll behavior | `overflow-x-auto` with `scroll-smooth`, custom scrollbar via `scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700` |
| Space between columns | `gap-4` |

### 4.3 Column

| Role | Value |
|---|---|
| Column width | `w-72` (fixed, never shrinks) |
| Column flex behavior | `flex-none` |
| Column outer container | `flex flex-col w-72 flex-none bg-zinc-900 rounded-xl border border-zinc-800` |
| Column header padding | `px-3 pt-3 pb-2` |
| Column header layout | `flex items-center justify-between` |
| Column card list | `flex flex-col gap-2 px-2 pb-2 overflow-y-auto` |
| Column card list max height | `max-h-[calc(100vh-12rem)]` |
| "Add card" button padding | `px-3 py-2` |
| "Add card" button layout | `flex items-center gap-1.5 w-full rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors` |

### 4.4 Card

| Role | Value |
|---|---|
| Card padding | `p-3` |
| Card border radius | `rounded-lg` |
| Card gap between internal rows | `flex flex-col gap-2` |
| Gap between title and metadata row | `gap-1.5` |
| Gap between badge and avatar | `gap-1.5` |

### 4.5 Modal

| Role | Value |
|---|---|
| Modal overlay | `fixed inset-0 z-50 flex items-center justify-center` |
| Modal container | `relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/80 overflow-hidden` |
| Modal header padding | `px-6 pt-5 pb-4 border-b border-zinc-800` |
| Modal body padding | `px-6 py-4 overflow-y-auto flex flex-col gap-5` |
| Modal footer padding | `px-6 py-4 border-t border-zinc-800` |

---

## 5. Component Specs

---

### 5.1 `AppShell`

The persistent chrome. Renders the top navigation bar; everything else is a child.

**Container:**
```
<div class="min-h-screen bg-zinc-950 flex flex-col">
  <nav class="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 flex-none z-40">
    ...
  </nav>
  <main class="flex-1 min-h-0 overflow-hidden">
    ...
  </main>
</div>
```

**Nav left region — app name + breadcrumb:**
```
<div class="flex items-center gap-2">
  <span class="text-lg font-semibold tracking-tight text-zinc-100">Kobani</span>
  <span class="text-zinc-600">/</span>
  <span class="text-sm font-medium text-zinc-300">{boardName}</span>
</div>
```

**Nav right region — notification bell + avatar:**
```
<div class="flex items-center gap-2">
  <!-- Notification bell -->
  <button class="relative p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
    <BellIcon class="w-5 h-5" />
    <!-- Badge: only rendered when count > 0 -->
    <span class="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] flex items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white px-0.5 tabular-nums">
      {count}
    </span>
  </button>

  <!-- User avatar -->
  <button class="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-200 hover:ring-2 hover:ring-zinc-500 transition-all overflow-hidden">
    <!-- If avatar URL: <img src="{url}" alt="{name}" class="w-full h-full object-cover" /> -->
    <!-- Fallback: first letter of display name -->
    {initial}
  </button>
</div>
```

**Notification bell badge visual states:**

| State | Classes |
|---|---|
| No notifications | badge not rendered |
| 1–9 | `bg-red-600 text-white` |
| 10+ | `bg-red-600 text-white` (truncated to "9+") |

---

### 5.2 `Board`

The horizontal scroll container that holds all columns.

```
<div class="flex flex-row items-start gap-4 overflow-x-auto px-6 pt-6 pb-6 min-h-0 h-full
            scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700 hover:scrollbar-thumb-zinc-600">
  {columns.map(col => <Column ... />)}
</div>
```

- `items-start` keeps columns top-aligned when they differ in height.
- `min-h-0` is required inside a flex column parent to allow proper scroll containment.
- The board itself does not scroll vertically; columns scroll vertically inside their own containers.

---

### 5.3 `Column`

**Outer container:**
```
<div class="flex flex-col w-72 flex-none bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
```

**Column header:**
```
<div class="flex items-center justify-between px-3 pt-3 pb-2">
  <span class="text-xs font-semibold uppercase tracking-widest text-zinc-400">{name}</span>
  <span class="text-xs font-medium text-zinc-500 tabular-nums">{cardCount}</span>
</div>
```

**Card list (scrollable):**
```
<div class="flex flex-col gap-2 px-2 pb-2 overflow-y-auto max-h-[calc(100vh-12rem)]
            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700">
  {cards.map(card => <Card ... />)}

  <!-- Drop ghost placeholder — shown only during active drag-over -->
  <div class="h-20 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/30 flex-none" />
</div>
```

**"Add card" button:**
```
<button class="flex items-center gap-1.5 w-full px-3 py-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800
               rounded-b-xl transition-colors text-sm">
  <span class="text-base leading-none">+</span>
  <span>Add card</span>
</button>
```

**Column drop-target highlight state** (active drag over this column, no specific position):
```
// Add to outer container when isDragOver and no child drop target is active:
ring-2 ring-inset ring-sky-700 bg-zinc-800/60
```

---

### 5.4 `Card`

The card is a draggable surface. Clicking it opens `CardDetailModal`.

**Default state:**
```
<div class="group relative flex flex-col gap-2 p-3 rounded-lg bg-zinc-800 border border-zinc-700
            shadow-sm shadow-black/40 cursor-grab active:cursor-grabbing
            hover:bg-zinc-700 hover:border-zinc-600 hover:shadow-md hover:shadow-black/60
            transition-colors duration-100 select-none">

  <!-- Card title -->
  <p class="text-sm font-medium text-zinc-100 leading-snug">{title}</p>

  <!-- Bottom row: status badge + assignee avatar + time-in-column -->
  <div class="flex items-center justify-between">
    <StatusBadge status={card.status} />
    <div class="flex items-center gap-2">
      <span class="text-xs text-zinc-500 tabular-nums">{timeInColumn}</span>
      <!-- Assignee avatar -->
      <div class="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] font-medium text-zinc-300 overflow-hidden flex-none">
        {assigneeInitial}
      </div>
    </div>
  </div>
</div>
```

**Accent border modifiers** — applied on top of the base card classes based on status:

| Status | Add these classes |
|---|---|
| `blocked` | `border-l-4 border-l-amber-500` |
| `evaluation-failed` | `border-l-4 border-l-red-500` |
| `pending-approval` | `border-l-4 border-l-yellow-500` |
| `failed` | `border-l-4 border-l-red-700` |

**Urgent escalation** (blocked or revision-needed for more than 1 hour): add `ring-1 ring-red-700 border-red-600` and replace the amber accent with `border-l-amber-400`.

---

### 5.5 `StatusBadge`

A pill that always shows: icon char + label. Never truncated.

**Base shell:**
```
<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border {bgClass} {textClass} {borderClass}">
  <span class="text-xs leading-none">{iconChar}</span>
  <span>{label}</span>
</span>
```

**Per-status values** (applying the palette from §2.3):

| Status | `bgClass` | `textClass` | `borderClass` | `iconChar` | `label` |
|---|---|---|---|---|---|
| `idle` | `bg-zinc-800` | `text-zinc-400` | `border-zinc-600` | `○` | `Idle` |
| `running` | `bg-sky-900/60` | `text-sky-300` | `border-sky-700` | `⟳` | `Running` |
| `blocked` | `bg-amber-900/60` | `text-amber-300` | `border-amber-600` | `⚠` | `Blocked` |
| `evaluating` | `bg-violet-900/60` | `text-violet-300` | `border-violet-700` | `◎` | `Evaluating` |
| `evaluation-failed` | `bg-red-900/60` | `text-red-300` | `border-red-700` | `✗` | `Eval Failed` |
| `pending-approval` | `bg-yellow-900/60` | `text-yellow-300` | `border-yellow-600` | `⏳` | `Pending Approval` |
| `completed` | `bg-emerald-900/60` | `text-emerald-300` | `border-emerald-700` | `✓` | `Completed` |
| `failed` | `bg-red-900/60` | `text-red-400` | `border-red-800` | `✗` | `Failed` |

---

### 5.6 `CardDetailModal`

A centered modal with a max width of `max-w-2xl`. It overlays the board with a backdrop scrim.

**Backdrop:**
```
<div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
     onClick={closeOnBackdropClick}>
```

**Modal container:**
```
<div class="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl
            border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/80 overflow-hidden"
     onClick={stopPropagation}>
```

**Header (always visible, does not scroll):**
```
<div class="flex items-start justify-between px-6 pt-5 pb-4 border-b border-zinc-800 flex-none">
  <div class="flex flex-col gap-1.5">
    <h2 class="text-base font-semibold text-zinc-100">{title}</h2>
    <div class="flex items-center gap-2">
      <StatusBadge status={status} />
      <span class="text-xs text-zinc-500">{role} · Attempt {n}/5 · {relativeTime}</span>
    </div>
  </div>
  <button class="text-zinc-500 hover:text-zinc-300 transition-colors p-1 -mr-1">
    <span class="text-lg leading-none">×</span>
  </button>
</div>
```

**Body (scrollable):**
```
<div class="flex flex-col gap-5 px-6 py-4 overflow-y-auto flex-1 min-h-0">
  <!-- Description -->
  <section class="flex flex-col gap-1.5">
    <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Description</span>
    <p class="text-sm text-zinc-400 leading-relaxed">{description}</p>
  </section>

  <!-- Acceptance Criteria -->
  <AcceptanceCriteriaList criteria={criteria} />

  <!-- Blocked banner — only when status === 'blocked' -->
  <BlockedBanner reason={blockedReason} sessionId={sessionId} />

  <!-- Agent Output Panel -->
  <AgentOutputPanel output={output} status={status} />

  <!-- Conditional action panel — only shown in relevant states -->
  <!-- See §5.6.1 below -->
</div>
```

**Footer (always visible, does not scroll):**
Only rendered for `pending-approval` and `evaluation-failed` / revision states.
```
<div class="flex items-center justify-between px-6 py-4 border-t border-zinc-800 flex-none bg-zinc-900">
  <!-- content varies by status — see §5.6.1 -->
</div>
```

#### 5.6.1 Conditional Action Panel by Status

**`pending-approval`** — in the modal footer:
```
<div class="flex items-center justify-between w-full">
  <button class="px-3 py-1.5 rounded-lg text-sm font-medium
                 text-red-400 border border-red-700 hover:bg-red-900/40 hover:text-red-300
                 transition-colors">
    ✗ Request Revision
  </button>
  <button class="px-4 py-1.5 rounded-lg text-sm font-semibold
                 bg-emerald-700 text-white hover:bg-emerald-600 active:bg-emerald-800
                 transition-colors">
    ✓ Approve &amp; Close
  </button>
</div>
```

**`evaluation-failed` (revision needed)** — context note textarea in the modal body (before agent output), send-back button in the footer:
```
<!-- In body, after AcceptanceCriteriaList -->
<section class="flex flex-col gap-2">
  <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
    Add context for the agent before sending back (optional)
  </span>
  <textarea rows="3"
            class="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2
                   text-sm text-zinc-100 placeholder:text-zinc-600
                   focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-500
                   resize-none transition-colors"
            placeholder="Explain what the agent should fix or clarify..." />
</section>

<!-- In footer -->
<button class="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold
               bg-sky-600 text-white hover:bg-sky-500 active:bg-sky-700
               transition-colors">
  Send back to In Progress
</button>
```

**`running`** — no footer. The output panel shows live streaming output with the `▌` cursor.

**`blocked`** — no footer. `BlockedBanner` is rendered in the body.

**`failed`** — retry schedule rendered in the body, below the output panel. No footer.
```
<div class="flex flex-col gap-1 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
  <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Retry Schedule</span>
  <!-- One row per attempt: -->
  <div class="flex items-center gap-3 text-xs text-zinc-500">
    <span class="tabular-nums w-16">Attempt {n}</span>
    <span class="{statusColor}">{attemptStatus}</span>
    <span class="tabular-nums">{timestamp}</span>
    <!-- If pending: show countdown -->
    <span class="text-zinc-400">(in {countdown})</span>
  </div>
</div>
```

**`completed` / `idle`** — no footer.

---

### 5.7 `AgentOutputPanel`

A scrollable monospace output area that streams tokens in real time.

**Container:**
```
<section class="flex flex-col gap-1.5">
  <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Agent Output</span>

  <div class="relative rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
    <pre class="text-sm font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap
                px-4 py-3 overflow-y-auto max-h-64
                scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700"
    >{output}<span class="animate-pulse text-zinc-400">▌</span></pre>
    <!-- The ▌ cursor is only rendered when status === 'running' or status === 'evaluating' -->
  </div>
</section>
```

**States:**

| State | Rendering |
|---|---|
| `running` or `evaluating` with output | Output text + blinking `▌` cursor via `animate-pulse` |
| `running` or `evaluating`, no output yet | Empty `pre` + blinking cursor only |
| Any completed state | Output text, no cursor |
| No output at all (idle, no run yet) | Empty state (see below) |

**Empty state** (shown when no AgentRun exists yet):
```
<div class="flex items-center justify-center h-20 text-sm text-zinc-600 italic">
  No output yet — agent has not started.
</div>
```

---

### 5.8 `AcceptanceCriteriaList`

A checklist with four visual states per criterion.

**Container:**
```
<section class="flex flex-col gap-1.5">
  <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Acceptance Criteria</span>
  <ul class="flex flex-col gap-2">
    {criteria.map(c => <AcceptanceCriterionRow criterion={c} />)}
  </ul>
</section>
```

**Per-criterion row — four states:**

| State | Icon | Icon color | Text classes | Evidence |
|---|---|---|---|---|
| `unchecked` | `◻` | `text-zinc-600` | `text-sm text-zinc-400` | not shown |
| `checking` | `⟳` | `text-violet-400 animate-spin` | `text-sm text-zinc-300` | `text-xs text-zinc-500 italic` "checking..." |
| `passed` | `✓` | `text-emerald-400` | `text-sm text-zinc-300` | evidence in monospace (see below) |
| `failed` | `✗` | `text-red-400` | `text-sm text-zinc-300` | evidence in monospace (see below) |

**Evidence line** (shown for `passed` and `failed`):
```
<p class="text-xs font-mono text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded ml-5 break-all">
  {evidence}
</p>
```

**Full row markup example (passed):**
```
<li class="flex flex-col gap-0.5">
  <div class="flex items-start gap-1.5">
    <span class="text-sm text-emerald-400 flex-none mt-0.5">✓</span>
    <span class="text-sm text-zinc-300">{criterionText}</span>
  </div>
  <p class="text-xs font-mono text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded ml-5 break-all">
    {evidence}
  </p>
</li>
```

---

### 5.9 `BlockedBanner`

Shown inside `CardDetailModal` when `status === 'blocked'`. Uses the amber palette.

**Container:**
```
<section class="flex flex-col gap-3 p-4 rounded-xl bg-amber-950/40 border border-amber-800">
```

**Blocked reason:**
```
<div class="flex flex-col gap-1">
  <div class="flex items-center gap-1.5">
    <span class="text-sm text-amber-400">⚠</span>
    <span class="text-xs font-semibold uppercase tracking-wider text-amber-500">Agent needs your input</span>
  </div>
  <p class="text-sm text-amber-200 leading-relaxed">{blockedReason}</p>
</div>
```

**Option A — Reply textarea:**
```
<div class="flex flex-col gap-2">
  <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Option A — Reply here</span>
  <textarea rows="3"
            class="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2
                   text-sm text-zinc-100 placeholder:text-zinc-600
                   focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-700
                   resize-none transition-colors"
            placeholder="Type your reply to the agent..." />
  <button class="self-start px-3 py-1.5 rounded-lg text-sm font-semibold
                 bg-amber-700 text-white hover:bg-amber-600 active:bg-amber-800
                 transition-colors">
    Send to agent
  </button>
</div>
```

**Option B — CLI attach command:**
```
<div class="flex flex-col gap-1.5">
  <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Option B — Connect via CLI</span>
  <div class="flex items-center gap-2 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2">
    <code class="text-xs font-mono text-zinc-300 flex-1 break-all">
      ant sessions connect {sessionId}
    </code>
    <button class="flex-none text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700
                   hover:border-zinc-500 rounded px-2 py-0.5 transition-colors"
            onClick={copyToClipboard}>
      Copy
    </button>
  </div>
</div>
```

**"Copy" button after copy success** — swap text to "Copied!" for 2 seconds then revert:
```
// Success state (transient, 2s):
class="flex-none text-xs text-emerald-400 border border-emerald-700 rounded px-2 py-0.5"
text: "Copied!"
```

---

### 5.10 `AttentionQueueDrawer`

A slide-in side drawer anchored to the right edge. Triggered by clicking the notification bell or a dedicated "Needs Attention" nav item.

**Backdrop:**
```
<div class="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200"
     onClick={closeDrawer}>
```

**Drawer panel:**
```
<aside class="fixed inset-y-0 right-0 z-50 w-96 flex flex-col bg-zinc-900 border-l border-zinc-800
              shadow-2xl shadow-black/60 overflow-hidden
              transition-transform duration-300 ease-out
              {isOpen ? 'translate-x-0' : 'translate-x-full'}">
```

**Drawer header:**
```
<div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-800 flex-none">
  <div class="flex items-center gap-2">
    <h2 class="text-base font-semibold text-zinc-100">Needs Attention</h2>
    <span class="text-xs font-medium bg-red-600 text-white rounded-full px-1.5 py-0.5 tabular-nums">
      {totalCount}
    </span>
  </div>
  <button class="text-zinc-500 hover:text-zinc-300 transition-colors p-1">×</button>
</div>
```

**Drawer body (scrollable):**
```
<div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5
            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700">
  <!-- Three groups, each rendered only when non-empty -->
  <AttentionGroup label="Blocked" items={blockedItems} />
  <AttentionGroup label="Revision Needed" items={revisionItems} />
  <AttentionGroup label="Pending Approval" items={approvalItems} />
</div>
```

**`AttentionGroup` section header:**
```
<div class="flex items-center gap-2 mb-2">
  <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
  <span class="text-xs text-zinc-600 tabular-nums">({count})</span>
</div>
```

**`AttentionGroup` card item:**
```
<div class="flex flex-col gap-2 p-3 rounded-xl bg-zinc-800 border border-zinc-700
            {urgentClasses}">
  <!-- Urgent label — only when escalated -->
  <span class="self-start text-[10px] font-bold uppercase tracking-widest text-red-400
               bg-red-950/60 border border-red-800 rounded px-1.5 py-0.5">
    Urgent
  </span>

  <!-- Top row: status badge + time in state -->
  <div class="flex items-center justify-between">
    <StatusBadge status={item.status} />
    <span class="text-xs text-zinc-500 tabular-nums">{timeInState}</span>
  </div>

  <!-- Card title + board/column path -->
  <div class="flex flex-col gap-0.5">
    <p class="text-sm font-medium text-zinc-100 leading-snug">{cardTitle}</p>
    <p class="text-xs text-zinc-500">{boardName} / {columnName}</p>
  </div>

  <!-- Reason / summary -->
  <p class="text-xs text-zinc-400 leading-relaxed line-clamp-2">{reason}</p>

  <!-- Action buttons — vary by status -->
  <div class="flex items-center gap-2 pt-0.5">
    {actionButtons}
  </div>
</div>
```

**Urgent escalation modifier** (more than 1 hour in blocked or revision-needed state):
```
urgentClasses = "border-red-600 ring-1 ring-red-700"
```
The "Urgent" label span is only rendered when `isUrgent === true`.

**Action buttons per status:**

| Status | Buttons |
|---|---|
| `blocked` | `Reply` (ghost) + `Connect via CLI` (ghost) |
| `evaluation-failed` (Revision Needed) | `View Evaluation Report` (ghost) |
| `pending-approval` | `Request Revision` (destructive ghost) + `Approve` (primary) |

Button classes in the drawer (compact size):
```
// Ghost action button:
class="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 border border-zinc-600
       hover:bg-zinc-700 hover:border-zinc-500 transition-colors"

// Primary (Approve):
class="px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-emerald-700
       hover:bg-emerald-600 transition-colors"

// Destructive ghost (Request Revision):
class="px-2.5 py-1 rounded-md text-xs font-medium text-red-400 border border-red-800
       hover:bg-red-950/60 transition-colors"
```

**Empty state** (all groups empty):
```
<div class="flex flex-col items-center justify-center flex-1 gap-2 text-zinc-600 py-12">
  <span class="text-3xl">✓</span>
  <p class="text-sm">Nothing needs your attention right now.</p>
</div>
```

---

## 6. Drag and Drop Visual States

### 6.1 Card Being Dragged

The card lifted from its origin slot. Applied to the element being dragged.

```
// Classes applied when isDragging === true:
opacity-60 rotate-2 scale-105 shadow-2xl shadow-black/80 cursor-grabbing ring-2 ring-sky-600 z-50
```

Transition applied to card enter/exit drag state:
```
transition-transform duration-150 ease-out
```

### 6.2 Drop Target Column Highlight

Applied to a `Column` when the dragged card hovers over it and the column accepts the drop.

```
// Add to column outer container:
ring-2 ring-inset ring-sky-700 bg-zinc-800/40
```

Transition:
```
transition-colors duration-100
```

### 6.3 Drop Target Position Ring

Applied to the specific inter-card gap that would receive the drop (position indicator within a column).

```
// A 2px ring line rendered between cards at the insertion point:
<div class="h-0.5 w-full rounded-full bg-sky-500 shadow-sm shadow-sky-500/50 mx-1" />
```

### 6.4 Placeholder Ghost

The empty slot left behind in the origin column as the card is being dragged.

```
<div class="rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/20 flex-none
            transition-all duration-150" />
```

The ghost height matches the dragged card's measured height dynamically (`style="height: {draggedHeight}px"`). `h-20` is the fallback default when height cannot be measured.

### 6.5 Snap Transition (Drop Landing)

When a card is dropped, it snaps into its final position. Apply this class to the card for the snap frame:

```
transition-transform duration-200 ease-out
```

The card returns to `opacity-100 rotate-0 scale-100 shadow-sm` on drop, animated over 200ms.

### 6.6 Invalid Drop Zone

When hovering over a column that does not accept the card (e.g. terminal column during an active run):

```
// Applied to the column outer container:
ring-2 ring-inset ring-red-800 cursor-no-drop
```

---

## 7. Responsive Behavior

### 7.1 Breakpoint

The responsive breakpoint is `md` (768px). Below `md`, the board shows the default horizontal-scroll layout. At `md` and above, the board switches to a stacked collapsible column layout per the cross-cutting requirement X.2 (no horizontal scrolling on tablet).

### 7.2 Tablet Layout (md and above)

The `Board` component switches from `flex-row overflow-x-auto` to a vertical stacked layout. Apply these classes at the `md` breakpoint:

**Board container at md+:**
```
md:flex-col md:overflow-x-visible md:overflow-y-auto md:px-4 md:gap-3
```

Full responsive class string for the Board container:
```
flex flex-row items-start gap-4 overflow-x-auto px-6 pt-6 pb-6 min-h-0 h-full
scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700
md:flex-col md:overflow-x-visible md:overflow-y-auto md:px-4 md:gap-3 md:items-stretch
```

**Column at md+** — full width, no fixed `w-72`:
```
// Responsive column outer container:
flex flex-col w-72 flex-none bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden
md:w-full md:flex-initial
```

**Column collapse behavior on tablet:**

Columns are collapsible by tapping/clicking the column header on tablet. All columns start expanded on page load.

- Collapsed state: card list is hidden (`hidden`), only the header row is visible.
- The column header shows a chevron indicator that rotates based on state:

```
<!-- Collapsed indicator in header, at md+ only: -->
<span class="hidden md:block text-zinc-600 text-xs ml-auto transition-transform duration-200
             {isCollapsed ? 'rotate-0' : 'rotate-180'}">
  ▾
</span>
```

- Card list visibility at md+:
```
// Expanded (default):
<div class="flex flex-col gap-2 px-2 pb-2 overflow-y-auto max-h-[calc(100vh-12rem)]
            md:max-h-none md:overflow-y-visible">

// Collapsed — add md:hidden to the card list div:
md:hidden
```

### 7.3 Mobile (below 768px)

Not in scope for Milestone 1. The board is horizontally scrollable on small screens via the default `overflow-x-auto` behavior, which is acceptable per the PRD scope.

---

## 8. Fake Data Visual Goal

At first load, the following card and status distribution ensures every badge variant appears within the first viewport without any scrolling. This distribution also serves as the primary visual QA test for the status color system.

### 8.1 Board: "Sprint 12 Board"

**Column 1 — BACKLOG** (Inactive column type)

| Card title | Status | Assignee | Time in column |
|---|---|---|---|
| API rate limit docs | `idle` | @lucas | 3d |

**Column 2 — IN PROGRESS** (Active column type)

| Card title | Status | Assignee | Time in column | Notes |
|---|---|---|---|---|
| Auth flow redesign | `running` | @lucas | 2m | Live cursor visible in output panel |
| DB migration rollback | `blocked` | @sam | 1h 14m | **Urgent** — accent border amber, ring red |
| Rate limiter edge cases | `failed` | @priya | 22m | Attempt 2/5, retry in 38s |

**Column 3 — REVIEW** (Review column type)

| Card title | Status | Assignee | Time in column |
|---|---|---|---|
| Onboarding copy update | `evaluating` | @lucas | 4m |
| API docs update | `pending-approval` | @lucas | 8m |
| Payment webhook handler | `evaluation-failed` | @sam | 31m |

**Column 4 — DONE** (Terminal column type)

| Card title | Status | Assignee | Time in column |
|---|---|---|---|
| Login page refactor | `completed` | @priya | 2h |

### 8.2 Badge Coverage

All 8 `StatusBadge` variants are simultaneously visible without scrolling:

`idle` (col 1) · `running` (col 2) · `blocked` (col 2) · `failed` (col 2) · `evaluating` (col 3) · `pending-approval` (col 3) · `evaluation-failed` (col 3) · `completed` (col 4)

### 8.3 Urgent Escalation Visibility

"DB migration rollback" in column 2 has been blocked for 1h 14m, triggering the urgent escalation style: `border-red-600 ring-1 ring-red-700` with the `Urgent` label rendered inside the `AttentionQueueDrawer` entry for that card.

### 8.4 Notification Bell and Drawer

The notification bell badge shows `3`. Opening the `AttentionQueueDrawer` shows:

- **Blocked (1):** "DB migration rollback" — Sprint 12 Board / In Progress — URGENT
- **Revision Needed (1):** "Payment webhook handler" — Sprint 12 Board / Review
- **Pending Approval (1):** "API docs update" — Sprint 12 Board / Review

---

*End of design spec.*
