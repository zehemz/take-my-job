# Card Detail View — Design Spec

The modal that surfaces full card context, supports inline editing, and streams live agent output over SSE.

---

## 1. Design Principles

**The modal is a workspace, not a read-only report.**
The user opens a card not just to read its state but to intervene — editing the brief, approving work, unblocking an agent, or deleting a dead card. Every section should feel ready to be touched, not merely observed.

**Read first, edit on intent.**
All content renders in read mode by default. Editing activates when the user explicitly signals intent (clicking a field, pressing a pencil icon). This prevents accidental edits during quick review passes and keeps the surface calm when the agent is already handling the work correctly.

**Inline edits, no separate page.**
There is no "edit card" page or full-modal-replacement edit mode. Editing happens in place — a field flips from display text to an input or textarea, saves on blur or explicit confirm, then flips back. The modal header and structure remain constant throughout.

**One primary action per context.**
When the card is `pending-approval`, the dominant action is Approve. When it is `blocked`, the dominant action is reply to agent. When the agent is running, the dominant action is to read. The design surfaces the right primary action per status and keeps secondary affordances (edit, delete) visually subordinate.

**Inherit the palette without exception.**
Background `zinc-950`, surface `zinc-900`, borders `zinc-800`/`zinc-700`, primary text `zinc-100`/`zinc-200`, secondary text `zinc-400`/`zinc-500`/`zinc-600`, single accent `indigo-600`. Status colors (amber/red/emerald/rose/sky/violet) are used only for `AgentStatusBadge` and alert banners, matching existing tokens already set in the codebase.

**Live updates are surfaced, not shouted.**
A small connection indicator replaces the bare pulse dot. It communicates SSE health without dominating the panel. When the connection drops, the indicator turns amber with a label — no banner, no dialog.

**Delete is an escape hatch, not a flow.**
Deletion is destructive and rare. The affordance exists in the modal footer, small and secondary, behind a single inline confirmation step. It does not interrupt the reading flow.

**Loading states are never blank.**
Skeleton rows fill the modal while card data loads from the API. The modal shell (backdrop, container, close button) renders immediately; only the content area skeletonizes.

---

## 2. View Mode

The modal renders in view mode by default. The layout from top to bottom:

### 2a. Modal shell

```
bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl
w-full mx-3 max-h-[95vh]
md:max-w-2xl md:mx-auto md:max-h-[90vh]
overflow-y-auto flex flex-col
```

Backdrop: `fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4`. Click backdrop to close. Escape key closes. Neither gesture closes mid-edit without a discard confirmation if there are unsaved changes.

### 2b. Header

```
┌─────────────────────────────────────────────────────┐
│  Card title                             [ column ✕ ] │
│  [ AgentStatusBadge ]  3h in Backlog                 │
└─────────────────────────────────────────────────────┘
```

- Title: `text-base font-semibold text-zinc-100`. Clicking the title activates inline edit (see Section 3).
- `AgentStatusBadge` — existing component, unchanged.
- Time-in-column: `text-xs text-zinc-500` — `{relativeTime(card.movedToColumnAt)} in {column.name}`.
- Close button: top-right, `text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded cursor-pointer`. Renders `✕`.

**Improvement — no current display of GitHub context.** The header should gain a secondary line beneath the status row when `githubRepo` or `githubBranch` is set:

```
[ branch-icon ]  owner/repo  ·  branch-name
```

Classes: `flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5`. The `owner/repo` fragment renders as `text-zinc-400` and the branch name as `text-zinc-300 font-mono`. The branch icon is a 12×12 SVG (git branch). No link unless a repo URL is derivable. This line is omitted entirely when both fields are null.

### 2c. Meta row

Rendered below the header, separated by `border-t border-zinc-800`:

```
Role: backend-engineer   Attempt: 2 / 5   Started: 47m ago
```

- Container: `px-6 py-3 flex items-center gap-4 text-xs text-zinc-500 shrink-0`.
- Each label is `text-zinc-500`; each value is `text-zinc-300`.
- Role value uses a `text-zinc-300` pill: `bg-zinc-800 rounded px-1.5 py-0.5 font-mono text-xs`.
- This row is only rendered when `currentRun` exists (no change from current behavior).

**Improvement — approved-by attribution.** When `card.approvedBy` and `card.approvedAt` are set, append a line below the meta row (same `px-6` padding, `border-t border-zinc-800`):

```
Approved by @username · 2h ago
```

Classes: `text-xs text-zinc-500`. `@username` is `text-zinc-300 font-mono`. `relativeTime(card.approvedAt)` for the timestamp. This is purely display; attribution is set server-side from the session and never editable.

### 2d. Description

`px-6 py-3 border-t border-zinc-800`. Text renders as `text-sm text-zinc-300 leading-relaxed`. When empty and the card is idle, show the placeholder text inline (see Section 7). Clicking activates inline edit.

### 2e. Blocked banner

Unchanged from current implementation. Renders only when `agentStatus === 'blocked'` and `blockedReason` is set.

### 2f. Acceptance Criteria

Section label: `text-xs font-semibold text-zinc-500 uppercase tracking-wider`. Criteria list uses existing `AcceptanceCriteriaList` component. In view mode, criteria are read-only. Adding, editing, and removing criteria happen in edit mode (Section 3e).

When SSE streams a criterion pass/fail state change, the corresponding row updates in place with a brief `transition-colors duration-300` on the icon — no flash or re-render jank.

### 2g. Agent Output

Section label row: `flex items-center gap-2 mb-3`.

```
[ AGENT OUTPUT label ]  [ SSE connection indicator ]
```

The SSE connection indicator replaces the bare pulse dot (full design in Section 4).

Output panel renders using existing `AgentOutputPanel`. The blinking cursor `▌` in `text-indigo-400 animate-pulse` is already implemented and remains unchanged.

Previous runs render under `<details>` with `summary` label `Attempt N — click to expand` in `text-xs text-zinc-500 cursor-pointer hover:text-zinc-300`.

### 2h. Retry schedule panel

Unchanged. Renders only when `agentStatus === 'failed'`.

### 2i. Revision context form

Unchanged. Renders only when column type is `revision`.

### 2j. Pending approval actions

Unchanged. Renders only when `agentStatus === 'pending-approval'`.

### 2k. Modal footer (delete affordance)

A persistent footer row, `border-t border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0`, sits below all status-conditional panels:

```
[ Delete card ]                               [ last updated: 2m ago ]
```

- Delete button: `text-xs text-zinc-600 hover:text-red-400 transition-colors cursor-pointer`. No background. No icon. The low contrast is intentional — this is a destructive escape hatch, not a call to action.
- Last-updated timestamp: `text-xs text-zinc-600`. `Updated {relativeTime(card.updatedAt)} ago`.

---

## 3. Edit Mode

### 3a. Affordance: pencil-on-hover

Editable fields reveal a pencil icon on hover. The pencil is a 12×12 SVG (`text-zinc-600 group-hover:text-zinc-400 transition-colors`). The field's container gets `group cursor-pointer` so the icon appears when the container is hovered. Clicking anywhere on the field — label, value, or pencil — activates editing.

There is no global "edit mode" toggle. Each field edits independently. This keeps the modal fast: a quick title fix does not lock every other field.

### 3b. Per-field save pattern

Each editable field has its own save/cancel pair that appears only while that field is active:

```
[ Save ]  [ Cancel ]
```

- Save: `bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer`
- Cancel: `text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer`
- Pressing Enter saves (except in textareas where Enter inserts a newline). Pressing Escape cancels and reverts. Clicking outside the field cancels (not saves) to prevent silent data loss from accidental defocus.
- Saving fires a `PATCH /api/cards/[id]` call. While the PATCH is in flight the field renders `opacity-60 pointer-events-none` and shows no spinner (the operation is fast enough that a spinner would flash annoyingly).
- On error, the field reverts to its pre-edit value and an inline error note appears below: `text-xs text-red-400`. No toast.

### 3c. Title (inline text input)

Active state:

```
<input
  type="text"
  className="w-full bg-transparent border-b border-indigo-500 text-base font-semibold text-zinc-100 outline-none pb-0.5 focus:border-indigo-400"
/>
```

The border-bottom treatment signals editability without surrounding the title in a box, keeping the header visually clean. Save / Cancel appear below the input as described in 3b.

### 3d. Description (inline textarea)

Active state: the read-only `<p>` is replaced by:

```
<textarea
  className="w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors"
  rows={4}
/>
```

Matches the existing textarea style used in `BlockedBanner` and `RevisionContextForm` for visual consistency. Save / Cancel buttons appear below the textarea.

### 3e. Acceptance Criteria (list edit)

When the section enters edit mode (pencil on the section label), each criterion becomes editable:

- Each criterion row gains an `×` delete button on the right: `text-zinc-600 hover:text-red-400 text-xs cursor-pointer transition-colors`.
- A text input replaces each criterion's `<span>`: `bg-transparent border-b border-zinc-700 focus:border-indigo-500 text-sm text-zinc-300 outline-none w-full`.
- An "Add criterion" row appears at the bottom of the list: `text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors flex items-center gap-1`. Label: `+ Add criterion`.
- Clicking "Add criterion" appends a new blank input that auto-focuses.
- A single Save / Cancel pair at the section footer (not per-criterion) confirms or discards all changes to the list in one PATCH call. This batches the diff and avoids N API calls for N edits.

`passed` and `evidence` fields on each criterion are not editable by the user — they are written by the agent and evaluator.

### 3f. Role (select dropdown)

Active state: the `text-zinc-300` role value becomes a `<select>` populated with all `AgentRole` values from `kanban-types.ts`. The select uses:

```
bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs rounded-md px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer
```

Change auto-saves on selection (no explicit Save/Cancel for a select — the intent is unambiguous). The role pill briefly flashes to confirm: `transition-colors duration-300` from `bg-indigo-900/40` back to `bg-zinc-800`.

### 3g. GitHub repo and branch (text inputs)

These fields appear in the header's secondary line (see 2b). They are editable inline. When neither is set, the entire secondary line is replaced by an "Add GitHub context" affordance: `text-xs text-zinc-600 hover:text-zinc-400 cursor-pointer flex items-center gap-1 transition-colors`. Label: `+ Add GitHub context`.

Clicking the affordance or the pencil on either field reveals two stacked inputs with Save / Cancel:

```
Repository   [ owner/repo       ]
Branch       [ main             ]
```

Label: `text-xs text-zinc-500`. Input: same textarea style at `text-xs`. Both fields save together in one PATCH.

---

## 4. SSE Live Updates

### 4a. Connection indicator

The existing bare pulse dot (`w-2 h-2 rounded-full bg-indigo-400 animate-pulse`) is replaced by a three-state indicator component, `SseIndicator`, placed in the Agent Output section label row — right-aligned within that flex row:

```
AGENT OUTPUT                            [ ● Live ]
                                        [ ◌ Reconnecting... ]
                                        [ ○ Disconnected ]
```

**Connected:**
`flex items-center gap-1.5 text-xs text-zinc-500`
Dot: `w-2 h-2 rounded-full bg-indigo-400 animate-pulse`
Label: `Live` in `text-zinc-500`

**Reconnecting:**
Dot: `w-2 h-2 rounded-full bg-amber-400 animate-pulse`
Label: `Reconnecting...` in `text-amber-500`
The reconnecting state appears after the first failed reconnect attempt (not immediately on the first drop — brief drops are invisible to the user).

**Disconnected:**
Dot: `w-2 h-2 rounded-full bg-zinc-600` (no pulse)
Label: `Disconnected` in `text-zinc-600`
A secondary note appears below the output panel: `text-xs text-zinc-600 mt-1` — `"Live updates paused. Reload to reconnect."` The word "Reload" is `text-indigo-400 cursor-pointer underline underline-offset-2` and triggers a hard reload of the SSE connection (not the page).

**Hidden when card is not live:**
The indicator does not render when `agentStatus` is `idle`, `completed`, `pending-approval`, or `failed`. It appears only when the SSE connection would be active (`running` or `evaluating`).

### 4b. What updates live

| Data | SSE event type | Update behavior |
|------|----------------|-----------------|
| Agent output text | `output_chunk` | Appended to `AgentOutputPanel` text buffer; cursor `▌` pulses at tail |
| `agentStatus` | `status_change` | `AgentStatusBadge` updates in place with `transition-all duration-300`; connection indicator re-evaluates visibility |
| Acceptance criterion `passed` / `evidence` | `criterion_update` | The relevant criterion row transitions: icon swaps from spinner to check/cross with `transition-colors duration-300`; evidence text fades in |
| `currentAgentRunId` | `run_change` | Current run panel refreshes; previous run is pushed into `<details>` history |

### 4c. Reconnect behavior

The client attempts exponential backoff reconnect: 1 s, 2 s, 4 s, 8 s, cap at 30 s. After three consecutive failures, the state moves from `reconnecting` to `disconnected`. A successful reconnect immediately resets to `connected` and emits a catch-up fetch (`GET /api/cards/[id]`) to fill any missed state — SSE is additive, not a full state source.

---

## 5. Delete Card

### 5a. Location and affordance

The delete affordance lives in the modal footer (see 2k): `text-xs text-zinc-600 hover:text-red-400 transition-colors cursor-pointer`. Low-contrast by design — it should not compete with the card content or the primary action.

### 5b. Confirmation pattern

No separate dialog. An inline two-step pattern within the footer:

**Step 1 (default):**
```
Delete card
```

**Step 2 (after first click — confirm state):**
```
[ Delete permanently ]   [ Keep ]
```

The footer collapses its right-side timestamp and expands to show the two buttons:
- Delete permanently: `text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 rounded-md px-2 py-1 transition-colors cursor-pointer`
- Keep: `text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors`

The confirm state auto-cancels (reverts to Step 1) after 5 seconds with no interaction. A brief `text-xs text-zinc-600` countdown is not shown — the auto-cancel is silent. This avoids pressuring the user while still not leaving the confirm state open indefinitely.

**On confirm:** fires `DELETE /api/cards/[id]`. The modal closes immediately (optimistic close). The card is removed from the Zustand store. If the delete fails, the card is re-inserted and a brief footer note appears: `text-xs text-red-400` — `"Could not delete card. Try again."`.

No toast. No redirect. The board view simply reflects the removed card when the modal closes.

### 5c. Restrictions

A card cannot be deleted while `agentStatus === 'running'`. In that state, clicking "Delete card" shows an inline note instead of advancing to Step 2: `text-xs text-zinc-500` — `"Stop the agent before deleting."` The note is rendered inline in the footer; the Delete button is not disabled (it responds to click with this message rather than being inert).

---

## 6. Component Inventory

### Modified components

| Component | File | Change |
|-----------|------|--------|
| `CardDetailModal` | `app/boards/[id]/_components/CardDetailModal.tsx` | Wire to `GET /api/cards/[id]` on open; subscribe to SSE at `/api/events/[cardId]`; add inline edit mode per field; add delete footer; add GitHub header line; add approved-by attribution row; render `SseIndicator` |
| `AcceptanceCriteriaList` | `app/boards/[id]/_components/AcceptanceCriteriaList.tsx` | Accept optional `editable` prop; render edit inputs, delete buttons, and add-criterion row when `editable === true` |

### New components

| Component | File | Purpose |
|-----------|------|---------|
| `SseIndicator` | `app/boards/[id]/_components/SseIndicator.tsx` | Three-state SSE connection dot + label. Accepts `status: 'connected' \| 'reconnecting' \| 'disconnected'` and `onReconnect: () => void`. Renders nothing when `status` is irrelevant. |
| `InlineEditField` | `app/boards/[id]/_components/InlineEditField.tsx` | Headless wrapper that manages the read/edit state toggle, Escape/blur cancel, and Save/Cancel button placement for a single field. Accepts `value`, `onSave(newValue)`, and `renderDisplay` / `renderInput` render props. Used by title, description, and GitHub fields. |
| `CardDeleteFooter` | `app/boards/[id]/_components/CardDeleteFooter.tsx` | Footer row with delete affordance and two-step inline confirmation. Accepts `cardId`, `agentStatus`, and `onDeleted` callback. |

### No new routes

The modal communicates via `GET /api/cards/[id]`, `PATCH /api/cards/[id]`, `DELETE /api/cards/[id]`, and SSE at `/api/events/[cardId]`. These are all defined by the engineer's tech spec; the design does not prescribe route file locations.

---

## 7. Copy and Microcopy

### Field placeholders (edit mode)

| Field | Placeholder |
|-------|-------------|
| Title input | `Card title` |
| Description textarea | `Describe the work for the agent...` |
| New acceptance criterion input | `Criterion text` |
| GitHub repo input | `owner/repo` |
| GitHub branch input | `main` |
| Revision reason textarea (existing) | `Describe what needs revision...` |
| Blocked reply textarea (existing) | `Reply to the agent...` |
| Revision context textarea (existing) | `Add context for the next attempt...` |

### Button labels

| Action | Label |
|--------|-------|
| Save an inline edit | `Save` |
| Cancel an inline edit | `Cancel` |
| Add GitHub context affordance | `+ Add GitHub context` |
| Add criterion affordance | `+ Add criterion` |
| Delete step 1 | `Delete card` |
| Delete step 2 — confirm | `Delete permanently` |
| Delete step 2 — keep | `Keep` |
| SSE reconnect label | `Reload` (inline in disconnected note) |
| Approve (existing) | `✓ Approve & Close` |
| Request Revision (existing) | `✗ Request Revision` |
| Send reply to agent (existing) | `Send to agent` |
| Revision context submit (existing) | `Send back to In Progress` |

### Empty states

| Context | Copy | Style |
|---------|------|-------|
| Description not set, card idle | `No description. Click to add one.` | `text-sm text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors` |
| Agent output, no run yet | `Waiting for agent output...` (existing) | `text-xs text-zinc-600` |
| Acceptance criteria empty, edit mode | `No criteria yet. Add the first one.` | `text-xs text-zinc-600` |
| GitHub context not set, hover | `+ Add GitHub context` | `text-xs text-zinc-600 hover:text-zinc-400 transition-colors` |

### Inline error notes

| Trigger | Copy |
|---------|------|
| PATCH fails on save | `Could not save. Try again.` |
| DELETE fails | `Could not delete card. Try again.` |
| Delete attempted while running | `Stop the agent before deleting.` |

### SSE indicator labels

| State | Dot color | Label |
|-------|-----------|-------|
| Connected | `bg-indigo-400 animate-pulse` | `Live` |
| Reconnecting | `bg-amber-400 animate-pulse` | `Reconnecting...` |
| Disconnected | `bg-zinc-600` | `Disconnected` |
| Disconnected panel note | — | `Live updates paused. Reload to reconnect.` |

### Approved-by attribution (view mode)

```
Approved by @{approvedBy} · {relativeTime(approvedAt)} ago
```

When `approvedBy` is null: this row does not render.

---

*Design by: Kobani product team*
*Last updated: 2026-04-13*
