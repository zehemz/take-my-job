# Approval Confirmation UX Design — Kobani

Explicit confirmation step before a card in `pending-approval` state is moved to `terminal`.

---

## 1. Chosen Pattern — Option A: Inline Expansion

**Decision:** Clicking "✓ Approve & Close" expands the `PendingApprovalActions` section in-place. The criteria list with evidence appears, a confirmation checkbox appears below it, and the Approve button activates only once the checkbox is checked.

### Justification

**Disruption level.** Option B (modal-within-modal) stacks two overlays, which disorients the user — they lose visual context of the card they're approving. Option C (full replacement panel) abandons the card detail entirely, removing the ability to glance back at the description or agent output while reviewing criteria. Option A keeps everything visible; the reviewer never loses the card's context.

**Implementation complexity.** Option A is a controlled state expansion within one existing component. It requires no portal, no z-index management, no additional overlay dismiss logic. Options B and C each require new mounting logic (a nested portal for B, a panel-swap mechanism for C) that interacts poorly with the existing SSE-driven re-render cycle in `CardDetailModal`.

**Focus.** The acceptance criteria + evidence data is already rendered in the scrollable body above `PendingApprovalActions`. Repeating it inside the expansion anchors the user's eye at the bottom of the modal during the confirmation step — the reviewer reads the evidence in the body, scrolls down, checks the box, approves. The flow is linear and proceeds downward without a context switch.

**Consistency.** The "Request Revision" path already expands inline (the revision textarea appears below the action row). Expanding for approval confirmation matches that established pattern exactly. The modal has a single interaction style for progressive disclosure.

---

## 2. Detailed Screen Design

### 2a. State A — Default (both buttons visible, no expansion)

This is the existing shipped state. Documented here for continuity only.

```
┌────────────────────────────────────────────────────────────────┐
│  [Card Title]                                           [✕]    │
│  [pending-approval badge]   3 days in Review                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [indigo banner: "This card is awaiting your review."]         │
│                                                                │
│  ─ ─ scrollable body ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  ROLE       GITHUB REPO        BRANCH                          │
│  ...                                                           │
│  ACCEPTANCE CRITERIA                                           │
│  ✅  Criterion one                                             │
│      Agent confirmed output matches expected schema.           │
│  ✅  Criterion two                                             │
│      All 14 tests pass; coverage at 91%.                       │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
├────────────────────────────────────────────────────────────────┤
│  [ ✗ Request Revision ]              [ ✓ Approve & Close ]     │
└────────────────────────────────────────────────────────────────┘
```

### 2b. State B — Confirmation Expanded (after clicking "Approve & Close")

```
┌────────────────────────────────────────────────────────────────┐
│  [Card Title]                                           [✕]    │
│  [pending-approval badge]   3 days in Review                   │
├────────────────────────────────────────────────────────────────┤
│  [indigo banner: "This card is awaiting your review."]         │
│  ─ ─ scrollable body ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  ...card detail fields...                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
├────────────────────────────────────────────────────────────────┤
│                          border-t zinc-800                     │
│  APPROVAL REVIEW                                               │  ← section label
│                                                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ ACCEPTANCE CRITERIA & EVIDENCE                         │    │  ← criteria panel
│  │ ─────────────────────────────────────────────────────  │    │
│  │  ✅  Criterion one                                     │    │
│  │      Agent confirmed output matches expected schema.   │    │
│  │                                                        │    │
│  │  ✅  Criterion two                                     │    │
│  │      All 14 tests pass; coverage at 91%.               │    │
│  │                                                        │    │
│  │  ✅  Criterion three                                   │    │
│  │      (no evidence provided)                            │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  [□]  I have reviewed all acceptance criteria and confirm      │  ← confirmation checkbox
│       this work meets the requirements.                        │
│                                                                │
│  [ ✗ Request Revision ]      [ ✓ Approve & Close  (disabled)] │  ← action row
└────────────────────────────────────────────────────────────────┘
```

### 2c. State C — Checkbox Checked (Approve button enabled)

```
│  [☑]  I have reviewed all acceptance criteria and confirm      │
│       this work meets the requirements.                        │
│                                                                │
│  [ ✗ Request Revision ]         [ ✓ Approve & Close ]          │
```

### 2d. State D — Loading (POST in flight after clicking Approve)

```
│  [☑]  I have reviewed all acceptance criteria and confirm      │
│       this work meets the requirements.                        │
│                                                                │
│  [ ✗ Request Revision ]         [ ↻ Approving...  (disabled)] │
```

Both buttons are disabled during the POST. The "Request Revision" button receives `opacity-50 pointer-events-none` — it is not removed, because removing it would cause layout shift.

### 2e. State E — Error (POST failed)

```
│  [☑]  I have reviewed all acceptance criteria and confirm      │
│       this work meets the requirements.                        │
│                                                                │
│  Something went wrong. Please try again.                       │  ← error line
│                                                                │
│  [ ✗ Request Revision ]         [ ✓ Approve & Close ]          │
```

The error message appears between the checkbox row and the action row. Both buttons are re-enabled after failure so the user can retry.

### 2f. Exact Tailwind classes — new and changed elements

**`PendingApprovalActions` outer container** — unchanged:
```
px-6 py-4 flex flex-col gap-3 shrink-0 border-t border-zinc-800
```

**Section label (appears when confirmation is expanded):**
```
text-xs font-semibold text-zinc-500 uppercase tracking-wider
```
Identical class pattern to the existing "Revision reason" label — consistent within the component.

**Criteria panel container:**
```
bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 flex flex-col gap-3
```
A contained surface that visually separates the criteria list from the checkbox. Uses `zinc-950` (one step darker than the modal surface `zinc-900`) to match the textarea treatment already in the revision form.

**Criteria panel inner header row:**
```
text-xs font-semibold text-zinc-500 uppercase tracking-wider pb-2 border-b border-zinc-800
```

**Individual criterion row container:**
```
flex flex-col gap-0.5
```

**Criterion first line (icon + text):**
```
flex items-start gap-2
```

**Criterion icon — passed:**
```
text-emerald-400 shrink-0 mt-0.5
```
Reuses existing `CriterionIcon` rendering. No new icon treatment needed.

**Criterion text:**
```
text-sm text-zinc-300
```
Identical to existing `AcceptanceCriteriaList` — same classes, different rendering location.

**Criterion evidence text (when `evidence` is non-null and non-empty):**
```
ml-6 text-xs text-zinc-500 font-mono
```
Identical to existing evidence rendering in `AcceptanceCriteriaList`.

**Criterion evidence text (when `evidence` is null or empty):**
```
ml-6 text-xs text-zinc-600 italic
```
`zinc-600` (one stop darker than the normal evidence colour) and italic distinguish the "no evidence" placeholder from real evidence, preventing the reviewer from mistaking silence for confirmation.

**Confirmation checkbox row container:**
```
flex items-start gap-2.5
```

**Confirmation checkbox input:**
```
w-4 h-4 rounded border border-zinc-600 bg-zinc-950 accent-indigo-600 cursor-pointer shrink-0 mt-0.5
```
Same pattern as the `requiresApproval` checkbox in `NewCardModal` (per `DESIGN.md` section 2c). Native `<input type="checkbox">` — no custom component.

**Confirmation checkbox label:**
```
text-sm text-zinc-300 leading-relaxed cursor-pointer select-none
```
`zinc-300` is one step brighter than body text (`zinc-400`) to draw attention to the commitment being made. `leading-relaxed` prevents the two-line label from feeling cramped.

**Error message line:**
```
text-xs text-red-400
```
Consistent with the existing `SaveCancelRow` error treatment (`text-xs text-red-400`).

**Approve button — disabled state:**
```
bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium opacity-40 pointer-events-none cursor-not-allowed
```
`opacity-40` rather than `opacity-50` or `opacity-60` to make the disabled state clearly inactive. Does not use `disabled` HTML attribute alone — the `pointer-events-none` class ensures no accidental hover state bleeds through.

**Approve button — enabled state:**
```
bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer
```
Identical to the current enabled state. No change from the shipped button — the only difference from disabled is removing `opacity-40 pointer-events-none` and restoring `hover:bg-indigo-500 transition-colors duration-150 cursor-pointer`.

**Approve button — loading state:**
```
bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium opacity-60 pointer-events-none cursor-not-allowed
```
`opacity-60` (slightly less faded than disabled `opacity-40`) signals activity rather than blockage. The label changes to "↻ Approving..." — the spinner character is used rather than an SVG to avoid layout reflow.

**"Request Revision" button — during loading:**
```
border border-red-500 text-red-400 bg-transparent rounded-md px-3 py-1.5 text-sm font-medium opacity-50 pointer-events-none
```

---

## 3. Criteria List Design

### 3a. Data source

`ApiAcceptanceCriterion` has four fields: `id` (string), `text` (string), `passed` (boolean | null), `evidence` (string | null).

In `pending-approval` state, all criteria have `passed: true` (the card cannot reach this state otherwise). The evidence field may be null or a non-empty string depending on the agent's output.

### 3b. Per-criterion layout

Each criterion is rendered as a `flex flex-col gap-0.5` block:

```
┌─────────────────────────────────────────────────────────────┐
│  ✅  Criterion text goes here (text-sm text-zinc-300)        │
│      Agent evidence text in monospace (text-xs text-zinc-500 font-mono)   │
└─────────────────────────────────────────────────────────────┘
```

When `evidence` is null or an empty string:

```
┌─────────────────────────────────────────────────────────────┐
│  ✅  Criterion text goes here                                │
│      No evidence provided.    (text-xs text-zinc-600 italic)│
└─────────────────────────────────────────────────────────────┘
```

The "No evidence provided." placeholder is shown — it is not omitted. A missing evidence field on a passing criterion is a notable data point for the reviewer; silently hiding it would obscure information at exactly the moment the reviewer needs it.

### 3c. Criteria panel scroll behaviour

The criteria panel (`bg-zinc-950 border border-zinc-800 rounded-lg`) is **not** independently scrollable unless there are more than 6 criteria. Below that threshold it renders at natural height. At 7 or more criteria, add:

```
max-h-48 overflow-y-auto
```

`max-h-48` (192px) fits approximately 4–5 criteria with evidence before scrolling begins, giving the reviewer a clear signal that more items exist below.

---

## 4. Confirmation Element

### 4a. Checkbox label (full text)

> I have reviewed all acceptance criteria and confirm this work meets the requirements.

This is a single sentence. It is presented as a `<label>` wrapping both the `<input type="checkbox">` and the text, so clicking anywhere on the text toggles the checkbox.

### 4b. Disabled Approve button state

Condition: `showConfirmation === true && confirmed === false` (the expansion has occurred but the checkbox is unchecked).

```
bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium opacity-40 pointer-events-none cursor-not-allowed
```

No tooltip is shown on the disabled button. The checkbox immediately above it communicates why it is inactive. Adding a tooltip would be redundant and would require hover state logic that conflicts with `pointer-events-none`.

### 4c. Enabled Approve button state

Condition: `showConfirmation === true && confirmed === true`.

```
bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer
```

### 4d. Label element structure

```
<label>
  <input type="checkbox" />   ← w-4 h-4 rounded border border-zinc-600 bg-zinc-950 accent-indigo-600 cursor-pointer shrink-0 mt-0.5
  <span>                      ← text-sm text-zinc-300 leading-relaxed cursor-pointer select-none
    I have reviewed all acceptance criteria and confirm this work meets the requirements.
  </span>
</label>
```

Container for the label element: `flex items-start gap-2.5`.

---

## 5. States

### 5a. State machine

```
DEFAULT (buttons visible, no expansion)
    │
    │  user clicks "✓ Approve & Close"
    ▼
EXPANDED (criteria panel + checkbox shown; Approve disabled)
    │
    │  user checks the confirmation checkbox
    ▼
READY (criteria panel + checkbox shown; Approve enabled)
    │
    │  user clicks "✓ Approve & Close"
    ▼
LOADING (POST in flight; both buttons disabled; label "↻ Approving...")
    │
    ├──── POST succeeds ────► modal closes (existing closeCardDetail() behaviour)
    │
    └──── POST fails    ────► ERROR (both buttons re-enabled; error message shown)
                                  │
                                  │  user clicks "✓ Approve & Close" again
                                  ▼
                              LOADING (retry)
```

From EXPANDED or READY, clicking "✗ Request Revision" collapses the confirmation panel (sets `showConfirmation = false`, `confirmed = false`) and opens the revision form (existing `showRevisionForm` path). The two flows are mutually exclusive.

### 5b. Boolean state required

| Variable | Type | Initial | Purpose |
|---|---|---|---|
| `showConfirmation` | `boolean` | `false` | Whether the confirmation expansion is visible |
| `confirmed` | `boolean` | `false` | Whether the checkbox is checked |
| `approving` | `boolean` | `false` | Whether the POST is in flight |
| `approveError` | `string` | `''` | Error message to display on POST failure |

`showConfirmation` resets to `false` when the revision form is opened. `confirmed` resets to `false` when `showConfirmation` is toggled off.

### 5c. DEFAULT state

- `showConfirmation: false`
- The criteria panel and checkbox are not rendered.
- "✓ Approve & Close" button uses its current enabled classes (no change from shipped state).

### 5d. EXPANDED state

- `showConfirmation: true`, `confirmed: false`
- Section label, criteria panel, and checkbox rendered above the action row.
- "✓ Approve & Close" button: `opacity-40 pointer-events-none cursor-not-allowed` (disabled treatment).

### 5e. READY state

- `showConfirmation: true`, `confirmed: true`
- Same layout as EXPANDED.
- "✓ Approve & Close" button: full enabled classes (`hover:bg-indigo-500 transition-colors duration-150 cursor-pointer`).

### 5f. LOADING state

- `approving: true`
- Button label: "↻ Approving..."
- "✓ Approve & Close" button: `opacity-60 pointer-events-none cursor-not-allowed`.
- "✗ Request Revision" button: `opacity-50 pointer-events-none`.
- Checkbox: unchanged visually (it remains checked and the label is readable).

### 5g. ERROR state

- `approving: false`, `approveError` is non-empty string.
- Error line (`text-xs text-red-400`) appears between the checkbox row and the action row.
- Both buttons return to their READY-state classes.
- `confirmed` remains `true` (checkbox stays checked) — the user does not need to re-check to retry.
- `approveError` clears when the user clicks "✓ Approve & Close" again (a new POST attempt begins).

---

## 6. Copy Table

| Element | Text |
|---|---|
| First-click behaviour of "✓ Approve & Close" | Expands the confirmation panel (no navigation, no API call) |
| Section label | `Approval Review` |
| Criteria subpanel header | `Acceptance Criteria & Evidence` |
| Criterion evidence placeholder (when evidence is null/empty) | `No evidence provided.` |
| Confirmation checkbox label | `I have reviewed all acceptance criteria and confirm this work meets the requirements.` |
| Approve button — default (expansion not yet triggered) | `✓ Approve & Close` |
| Approve button — disabled (expansion shown, unchecked) | `✓ Approve & Close` |
| Approve button — enabled (expansion shown, checked) | `✓ Approve & Close` |
| Approve button — loading | `↻ Approving...` |
| Approve button — error (after failed POST, re-enabled) | `✓ Approve & Close` |
| Error message | `Something went wrong. Please try again.` |
| Request Revision button — all states | `✗ Request Revision` (unchanged) |

### Copy rationale

**"Approval Review"** rather than "Confirm Approval" or "Review Checklist": the noun form treats this as a named step in the workflow, not an imperative command. It reads as a section heading, which is what it is.

**"Acceptance Criteria & Evidence"** as the inner panel header: mirrors the existing "Acceptance Criteria" section heading in the modal body, making the connection explicit — the reviewer knows they are looking at the same data set, not a summary or subset.

**"No evidence provided."** rather than silence: absence of evidence is itself information. The reviewer should actively note that the agent did not produce evidence for a criterion, not assume it was omitted from the UI.

**Confirmation checkbox label — first person, present tense**: "I have reviewed... and confirm" commits the reviewer to a deliberate statement rather than an acknowledgment. "I confirm" is actionable; "I understand" or "I acknowledge" would be passive.

**Error copy — "Something went wrong. Please try again."**: plain, non-technical, consistent with the existing error treatment in `SaveCancelRow`. No error codes, no diagnostic text — this surfaces in the UI; diagnostic logging goes to the console.

---

## 7. Component Inventory

### 7a. New internal components (within `CardDetailModal.tsx`)

None. All new UI is rendered inline within the existing `PendingApprovalActions` function, following the same pattern as the existing `showRevisionForm` expansion. No new named sub-functions are required.

### 7b. Modified components

| Component | File | Changes |
|---|---|---|
| `PendingApprovalActions` | `app/boards/[id]/_components/CardDetailModal.tsx` | Add `showConfirmation`, `confirmed`, `approving`, `approveError` state variables. Change `handleApprove` to first set `showConfirmation = true` (if not already shown), then on second call (when `confirmed`) perform the POST with loading/error handling. Render criteria panel + checkbox + error line conditionally on `showConfirmation`. Accept `criteria: ApiAcceptanceCriterion[]` as a new prop. |

`PendingApprovalActions` currently takes `{ cardId: string }`. It needs one additional prop:

```
{ cardId: string; criteria: ApiAcceptanceCriterion[] }
```

The criteria are already available at the `CardDetailModal` call site from `apiCard.acceptanceCriteria`.

### 7c. Unchanged components

| Component | Note |
|---|---|
| `AcceptanceCriteriaList` | Not reused inside the confirmation panel. The panel renders criteria directly to avoid a dependency on the `cardStatus` prop (which in the confirmation context is always `pending-approval`, making the `isEvaluating` branch irrelevant). Keeping it inline avoids prop threading and keeps the confirmation panel self-contained. |
| `PendingApprovalBanner` | Unchanged. The banner copy ("All acceptance criteria passed.") remains accurate. |
| `CardDetailModal` | The only change is passing `criteria={apiCard.acceptanceCriteria}` to `<PendingApprovalActions>`. |

### 7d. No new files

The design requires no new files. All changes are contained within `CardDetailModal.tsx`.

---

*Design by: Kobani design team*
*Last updated: 2026-04-13*
