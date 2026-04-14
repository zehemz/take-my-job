# Approval Workflow UX Design — Kobani

Human-in-the-loop gate before a card reaches the `terminal` column.

---

## 1. Design Principles

**The default is safety.**
`requiresApproval` defaults to checked. An agent completing its work should never silently close a card — a human must actively opt a card out of review, not opt into it. The UI reinforces this by framing the checkbox as "opt-out of review", not "request review".

**Approval state is unmistakable.**
When a card is awaiting human review, every surface that can communicate that fact does so. The card detail modal uses a banner, a dedicated action panel, and a status badge — three independent signals. There is no ambiguity about what is needed from the user.

**Invalid drag targets disappear, not error.**
Rather than showing an error toast when a drag lands on an invalid column, invalid targets visually recede as soon as a drag begins. The user's attention is guided toward valid targets without any modal interruption or undo affordance.

**Destructive irreversibility is front-loaded.**
"Approve & Close" moves the card to `terminal` permanently. "Request Revision" routes it back to `active`. Both actions close the modal immediately after confirmation. No undo is provided — the copy makes the consequence explicit before the click.

**Inherit the existing palette without exception.**
Background `zinc-950`, surfaces `zinc-900`, borders `zinc-800`/`zinc-700`, primary text `zinc-100`, secondary `zinc-400`/`zinc-500`, accent `indigo-600` only. Destructive actions use `red-500` for borders and text; they never use `indigo`.

---

## 2. Design Area 1 — `requiresApproval` Checkbox in NewCardModal

### 2a. What changes

A single checkbox field is appended to the form in `NewCardModal.tsx`, directly above the footer action row (Cancel / Create Card). It does not disrupt the existing field order.

### 2b. Wireframe

```
┌──────────────────────────────────────────────────┐
│  New Card                                  [✕]   │
│ ─────────────────────────────────────────────── │
│  TITLE *                                         │
│  ┌────────────────────────────────────────────┐  │
│  │ Card title...                              │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  AGENT ROLE                                      │
│  ┌────────────────────────────────────────────┐  │
│  │ backend-engineer                        ▾  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  DESCRIPTION                                     │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ACCEPTANCE CRITERIA                             │
│  One criterion per line                          │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  GITHUB REPO     │  │  BRANCH              │  │
│  │  org/repo        │  │  feat/my-branch       │  │
│  └──────────────────┘  └──────────────────────┘  │
│                                                  │
│  ─────────────────────────────────────────────  │  ← border-t border-zinc-800
│                                                  │
│  [✓] Requires human approval before closing      │  ← NEW checkbox row
│      Agent output will go to review before       │
│      this card can be closed.                    │
│                                                  │
│  ─────────────────────────────────────────────  │  ← border-t border-zinc-800
│                           [ Cancel ] [Create ▶]  │
└──────────────────────────────────────────────────┘
```

### 2c. Exact Tailwind classes

**Checkbox row container:**
```
flex flex-col gap-1.5 py-3
```

**Checkbox + label wrapper (first line):**
```
flex items-center gap-2.5 cursor-pointer select-none
```

**Checkbox input element:**
```
w-4 h-4 rounded border border-zinc-600 bg-zinc-950
accent-indigo-600 cursor-pointer shrink-0
```
Uses native `<input type="checkbox">` with CSS `accent-color` matching `indigo-600`. No custom checkbox component needed.

**Label text (first line):**
```
text-sm text-zinc-200 font-medium
```

**Helper text (second line, below label):**
```
text-xs text-zinc-500 leading-relaxed ml-6.5
```
The `ml-6.5` (approximately `26px`) aligns the helper text flush with the label text, past the checkbox and gap.

**Placement in form:** Inserted as a sibling `<div>` between the GitHub fields grid and the existing footer `<div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">`. The checkbox row has its own `border-t border-zinc-800` above it to visually separate it from the GitHub fields.

### 2d. State behavior

- Default state: `checked` (`useState(true)`).
- The checked state is passed to `createCardApi` as `requiresApproval: boolean`.
- No conditional fields appear or disappear based on the checkbox — it is a simple boolean toggle.
- When unchecked: helper text changes to `"This card will close automatically when all criteria pass."` (`text-xs text-zinc-500`). This makes the consequence of unchecking explicit.

### 2e. Component inventory

| Component | Status | Change |
|---|---|---|
| `NewCardModal` | Modified | Add `requiresApproval` state (`true` default). Add checkbox row above footer. Pass value to `createCardApi`. |

No new components. The checkbox is an inline addition to the existing form.

### 2f. Copy

| Element | Checked state | Unchecked state |
|---|---|---|
| Checkbox label | `Requires human approval before closing` | `Requires human approval before closing` |
| Helper text | `Agent output will go to review before this card can be closed.` | `This card will close automatically when all criteria pass.` |

---

## 3. Design Area 2 — Restricted Drag-and-Drop

### 3a. Valid transition matrix

| From \ To | inactive | active | review | revision | terminal |
|---|---|---|---|---|---|
| `inactive` | — | ✅ | ❌ | ❌ | ❌ |
| `active` | ❌ | — | ✅ | ✅ | ❌ |
| `review` | ❌ | ❌ | — | ✅ | ✅ |
| `revision` | ❌ | ✅ | ❌ | — | ❌ |
| `terminal` | ❌ | ❌ | ❌ | ❌ | — |

A card cannot be dragged to the column it already lives in (same-column drops are always no-ops).

### 3b. Visual behavior

**Before drag begins:** All columns render at full opacity. No pre-emptive highlighting.

**During drag (card being held):**

- Valid target columns: full opacity (`opacity-100`). When the drag cursor enters a valid column, the existing indigo drop indicator appears — `border-2 border-indigo-500 border-dashed` on the column container, or a `2px` indigo insertion line between cards, depending on the current drop position implementation.
- Invalid target columns: `opacity-40 pointer-events-none`. The column still renders its header and cards but does not respond to hover or drop events. No error indicator is shown — the column simply recedes.
- The source column (where the card originated): treated as an invalid target and rendered at `opacity-40` for the duration of the drag (dropping back to origin is a cancel, not a move).

**On drop:**

- Valid column: card moves, columns return to `opacity-100`. Existing move behavior executes.
- Invalid column: because `pointer-events-none` is applied, the drop event cannot fire on the column element. The drag library's default "drop cancelled" behavior returns the card to its origin. No toast, no error message, no animation beyond the card snapping back.

### 3c. Exact Tailwind classes

**Valid target column (during drag, not yet hovered):**
```
opacity-100 transition-opacity duration-150
```

**Valid target column (drag cursor over it — drop indicator active):**
```
opacity-100 border-2 border-dashed border-indigo-500 rounded-xl transition-colors duration-150
```

**Invalid target column (any time a drag is in progress):**
```
opacity-40 pointer-events-none transition-opacity duration-150
```

**Source column (drag in progress, card originated here):**
```
opacity-40 pointer-events-none transition-opacity duration-150
```

The `transition-opacity duration-150` on all states ensures columns fade smoothly as drag begins and ends, rather than snapping between states.

### 3d. Implementation note for the design boundary

This spec covers the visual treatment only. The transition validity table above defines which column types accept drops from which source types. The drag library's `canDrop` or equivalent predicate receives the dragged card's current column type and the target column's type, then consults this table. The designer's concern ends at: valid targets stay visible and show the indigo indicator; invalid targets fade to `opacity-40`.

### 3e. Component inventory

| Component | Status | Change |
|---|---|---|
| Board column container | Modified | Accept `isValidDropTarget: boolean` and `isDragInProgress: boolean` props (or derive from drag context). Apply opacity classes conditionally. |

No new components. The change is conditional class application on the existing column wrapper element.

### 3f. Edge cases

**Dragging to `terminal`:** Only cards from `review` may enter `terminal`. This column should therefore show `opacity-40` for all drags originating from `inactive`, `active`, or `revision`. Terminal is a one-way exit — there are no outgoing transitions from it.

**`terminal` cards being dragged:** Cards in `terminal` cannot be dragged to any column (no valid outgoing transitions). If the drag library allows dragging terminal cards, all other columns render at `opacity-40` for the duration of the drag, and the card returns to `terminal` on drop.

**Single-column boards:** Not applicable — Kobani boards always have all five column types.

---

## 4. Design Area 3 — Pending-Approval State in CardDetailModal

### 4a. When this state appears

`card.agentStatus === 'pending-approval'` AND the card is in the `review` column. This means the agent ran, all acceptance criteria passed, and the card is now waiting for a human decision before it can proceed to `terminal`.

### 4b. Modal structure in this state

The modal is rendered in its standard layout (`bg-zinc-900 border border-zinc-800 rounded-xl`). Two new elements are added relative to the baseline modal:

1. A **pending-approval banner** injected directly below the modal header, before the scrollable body content.
2. The **`PendingApprovalActions` panel** at the bottom of the modal (already exists as a built component — see Section 4e for its design spec).

```
┌────────────────────────────────────────────────────────────────┐
│  [Card Title]                                           [✕]    │  ← Header (unchanged)
│  [pending-approval badge]   3 days in Review                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ╔══════════════════════════════════════════════════════════╗  │
│  ║  This card is awaiting your review.                     ║  │  ← Pending-approval banner
│  ║  All acceptance criteria passed.                        ║  │    (NEW — see 4c)
│  ╚══════════════════════════════════════════════════════════╝  │
│                                                                │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← scrollable body begins
│                                                                │
│  ROLE          GITHUB REPO         BRANCH                      │
│  tech-lead     org/repo            feat/my-branch              │
│                                                                │
│  DESCRIPTION                                                   │
│  ...                                                           │
│                                                                │
│  ACCEPTANCE CRITERIA                                           │
│  ✓ Criterion one                          passed               │
│  ✓ Criterion two                          passed               │
│  ✓ Criterion three                        passed               │
│                                                                │
│  AGENT OUTPUT                                                  │
│  [ agent output panel — collapsed/scrollable ]                 │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [ ✗ Request Revision ]            [ ✓ Approve & Close ]       │  ← PendingApprovalActions (4d)
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

The banner and actions panel are both `shrink-0` — they are not scrolled away. The banner sits at the top of the scrollable region so the user sees it immediately on open, but it will scroll with the content if the modal body is taller than the viewport. The actions panel is pinned at the bottom via `shrink-0 border-t border-zinc-800` (matching the existing `PendingApprovalActions` wrapper classes already in the component).

### 4c. Pending-approval banner

**Placement:** Immediately below the header `<div>`, before any meta row or scrollable content. It sits inside the modal's flex column, as a `shrink-0` element.

**Container:**
```
mx-6 mt-2 mb-0 bg-indigo-950 border border-indigo-800 rounded-lg px-4 py-3
```

**Inner layout:** `flex items-start gap-3`

**Icon:** A simple circle-check SVG (`16×16`, `text-indigo-400`, `shrink-0 mt-0.5`). Uses the same SVG icon style as `AgentStatusBadge`. No emoji.

**Text block:** `flex flex-col gap-0.5`

- First line: `text-sm font-medium text-indigo-200` — primary message.
- Second line: `text-xs text-indigo-400` — supporting detail.

**Full wireframe of banner element:**

```
┌──────────────────────────────────────────────────────────────┐
│  [○✓]  This card is awaiting your review.                    │
│        All acceptance criteria passed.                       │
└──────────────────────────────────────────────────────────────┘
   indigo-950 bg / indigo-800 border / indigo-200+indigo-400 text
```

**No close/dismiss button.** The banner is informational and tied to `agentStatus`. It disappears when the user takes an action (approve or request revision), which changes the status.

### 4d. `PendingApprovalActions` panel — design spec

The component already exists at lines 156–207 of `CardDetailModal.tsx`. This section documents the intended visual design of the two states.

**Default state (revision form hidden):**

```
┌──────────────────────────────────────────────────────────────┐
│                                         border-t zinc-800    │
│  [ ✗ Request Revision ]            [ ✓ Approve & Close ]     │
└──────────────────────────────────────────────────────────────┘
```

Panel container: `px-6 py-4 flex flex-col gap-3 shrink-0 border-t border-zinc-800` (already implemented).

Action row: `flex items-center justify-between` (already implemented).

**"Approve & Close" button:**
```
bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer
```
Positioned on the right side of the `justify-between` row. Clicking immediately calls `approveCard(cardId)` and `closeCardDetail()`. No confirmation step — the banner already communicated the consequence.

**"Request Revision" button (initial state — form hidden):**
```
border border-red-500 text-red-400 hover:bg-red-500 hover:text-white bg-transparent rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer
```
Positioned on the left side. First click reveals the inline revision form (described below) — it does not immediately submit.

**"Request Revision" — form-expanded state:**

```
┌──────────────────────────────────────────────────────────────┐
│                                         border-t zinc-800    │
│  REVISION REASON                                             │  ← label row
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Describe what needs revision...                        │  │  ← textarea (2 rows)
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [ ✗ Request Revision ]            [ ✓ Approve & Close ]     │
└──────────────────────────────────────────────────────────────┘
```

**Revision reason label:** `text-xs font-semibold text-zinc-500 uppercase tracking-wider` (already implemented).

**Revision textarea:**
```
w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors
```
`rows={2}` (already implemented). Placeholder: `"Describe what needs revision..."`.

**"Request Revision" button — form-expanded, note filled:**
Once `showRevisionForm` is true and `revisionNote.trim()` is non-empty, a second click on the button submits: calls `requestRevision(cardId, revisionNote)` then `closeCardDetail()`. The button label and style do not change between the two click states — the action is differentiated by the presence of the form, not by a label change.

**"Request Revision" button — form-expanded, note empty:**
The button remains visually unchanged but does not submit (the `if (showRevisionForm && revisionNote.trim())` guard prevents submission). No error indicator is shown for an empty note — the placeholder text in the textarea is the only prompt. This keeps the panel visually calm.

**Approve & Close while revision form is open:** Fully enabled. The user may change their mind after revealing the revision form and approve instead. Clicking "Approve & Close" closes immediately regardless of revision form state.

### 4e. Component inventory

**New components:**

| Component | Path | Description |
|---|---|---|
| `PendingApprovalBanner` | Inline in `CardDetailModal.tsx` | Functional component (no props beyond `className` if needed). Renders the `bg-indigo-950 border-indigo-800` informational strip. Extracted as a named function within the file, consistent with how `BlockedBanner` and `RevisionContextForm` are structured. |

**Modified components:**

| Component | Change |
|---|---|
| `CardDetailModal` | Render `<PendingApprovalBanner />` between the header `<div>` and the meta row, conditionally when `card.agentStatus === 'pending-approval'`. Render `<PendingApprovalActions cardId={card.id} />` at the bottom of the modal, conditionally when `card.agentStatus === 'pending-approval'` (replacing the current guard that never triggers it from real data). |

**Unchanged components:**

| Component | Note |
|---|---|
| `PendingApprovalActions` | Already built. No visual changes needed — the existing classes match this spec exactly. The only change is wiring it to real `agentStatus` data. |

---

## 5. Copy

### 5a. NewCardModal — requiresApproval checkbox

| Element | Text |
|---|---|
| Checkbox label | `Requires human approval before closing` |
| Helper text (checked) | `Agent output will go to review before this card can be closed.` |
| Helper text (unchecked) | `This card will close automatically when all criteria pass.` |

### 5b. Drag-and-drop — no copy

The restricted drag-and-drop feature is entirely visual. No tooltip, toast, or error message is shown when an invalid drop is attempted. The opacity treatment is the sole communication channel.

### 5c. Pending-approval banner

| Element | Text |
|---|---|
| Banner primary line | `This card is awaiting your review.` |
| Banner secondary line | `All acceptance criteria passed.` |

### 5d. PendingApprovalActions panel

| Element | Text |
|---|---|
| Revision reason section label | `Revision reason` |
| Revision textarea placeholder | `Describe what needs revision...` |
| "Request Revision" button | `✗ Request Revision` |
| "Approve & Close" button | `✓ Approve & Close` |

### 5e. Microcopy rationale

**"Approve & Close"** rather than "Approve": the word "Close" makes the consequence explicit — the card leaves the board's active workflow permanently. Users who have not read the PRD still understand what will happen.

**"Request Revision"** rather than "Reject" or "Send back": "Reject" carries a negative connotation that may discourage use. "Request Revision" is neutral and action-oriented — it frames the outcome as initiating more work, not failing the agent.

**"Requires human approval before closing"** rather than "Enable approval": the phrase "before closing" anchors the checkbox to its effect, not to an abstract feature toggle. Users scanning the form quickly understand when this setting matters.

---

## 6. Edge Cases

### 6a. Card reaches `pending-approval` while CardDetailModal is open

The modal uses SSE (`/api/events/{cardId}`) and re-fetches on `status_change` events. When the agent completes and the status transitions to `pending-approval`, the SSE connection fires a `status_change` event, `fetchCard` is called, `apiCard.agentStatus` becomes `'pending-approval'`, and the banner and actions panel render without requiring the user to close and reopen the modal.

### 6b. User approves and immediately navigates back to the board

After `approveCard(cardId)` and `closeCardDetail()`, the board's store should reflect the card moving to the `terminal` column. If the store update is asynchronous, a brief flash of the card in `review` may occur. This is an implementation detail, not a design concern — no loading state is designed for the approval action itself.

### 6c. `requiresApproval: false` — card auto-closes

When `requiresApproval` is unchecked at creation time, the card bypasses `pending-approval` entirely. Its `agentStatus` transitions directly from `evaluating` to `done` and the card moves to `terminal` without any human action. The `CardDetailModal` never shows the banner or `PendingApprovalActions` for these cards.

### 6d. Agent fails criteria — card does not enter `pending-approval`

`pending-approval` is only reached when all criteria pass. If any criterion fails, the card enters a retry or `failed` state per existing behavior. The approval UI is not shown in that case. The `AcceptanceCriteriaList` already visually distinguishes `passed: true` / `passed: false` / `passed: null` — no change needed there.

### 6e. Drag: `terminal` cards

Cards already in `terminal` are read-only in product terms — they represent completed work. If the drag library allows initiating a drag on a terminal card, all other columns render at `opacity-40 pointer-events-none` and the card returns to `terminal` on drop release (no valid outgoing transition exists). Ideally the drag handle on terminal cards is removed or `pointer-events-none` applied at the card level to prevent the drag from starting at all.

### 6f. Drag: column with no cards (empty state)

An empty column is still a valid drop target if the transition rules allow it. Its visual state (full opacity vs. faded) follows the same rules as a populated column. The drop zone should cover the full column body including its empty state placeholder text.

### 6g. Revision form — note required vs. optional

The current implementation (`PendingApprovalActions`) does not enforce a non-empty revision note — the button guard is `if (showRevisionForm && revisionNote.trim())`. This means clicking "Request Revision" with an empty textarea is a no-op (the form stays open). The design deliberately avoids adding an error message here, relying instead on the placeholder text as a nudge. If product decides to enforce a non-empty note, the addition of `text-xs text-red-400 mt-1` error text below the textarea is the appropriate treatment — no design change to the button or form structure is required.

---

*Design by: Kobani product team*
*Last updated: 2026-04-13*
