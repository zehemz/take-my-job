# PRD: Approval Confirmation Step

**Product:** Kobani  
**Feature:** Explicit Confirmation Before Card Approval  
**Parent:** [Approval Workflow PRD](./PRD.md)  
**Status:** Draft  
**Author:** Lucas Bais  
**Date:** 2026-04-13

---

## 1. Problem Statement

The approval action in the existing Approval Workflow PRD (§4.2) is a single button click — "Approve & Close". That is insufficient for three reasons.

**Audit risk.** The only evidence that a reviewer looked at a card is the `approvedBy` / `approvedAt` timestamp pair. Neither field records whether the reviewer actually examined the acceptance criteria evidence produced by the agent run. In any audit, "I clicked a button" is not a credible sign-off.

**Accidental approval.** A reviewer scanning the Attention Queue can click "Approve" on the wrong card, or double-click and fire the action before reading anything. Because the card immediately transitions to `terminal` (a locked, final state), there is no recovery path short of a manual database intervention.

**No evidence of criteria review.** The agent run attaches pass/fail evidence for every acceptance criterion listed on the card. That evidence is the entire point of the agent's work — yet nothing in the current flow requires the reviewer to open it, scroll through it, or acknowledge it. Rubber-stamping is indistinguishable from genuine review.

This document specifies a lightweight confirmation step that closes those gaps without adding bureaucratic overhead.

---

## 2. Goals

- Require the reviewer to take an explicit, deliberate action — beyond a single button click — before an approval is submitted.
- Surface all acceptance criteria and their pass/fail evidence from the completed agent run at the moment of confirmation, so the reviewer cannot claim ignorance of what they are signing off on.
- Keep the approval path to two steps maximum (initiate → confirm) to avoid friction that would push reviewers toward workarounds.
- Ensure `approvedBy` and `approvedAt` continue to be set exclusively server-side from the authenticated session; the confirmation step adds no new client-supplied fields.
- Provide a clear, zero-consequence escape hatch (Cancel) that returns the reviewer to the card detail without any state change.

---

## 3. Non-Goals

- **Per-criterion sign-off.** Requiring the reviewer to tick a checkbox against each individual acceptance criterion is too granular for v1 and would slow approvals significantly for cards with many criteria. A single confirmation that all criteria have been reviewed is sufficient.
- **Comments or discussion threads.** The reviewer cannot leave a note attached to the approval record in this phase. Annotation is deferred.
- **Multi-approver quorum.** This remains a single-approver action as specified in the parent PRD (§3).
- **Confirmation on "Request Revision".** The revision path is already deliberate — it requires a non-empty reason string before submission. No additional confirmation step is needed there.
- **Re-checking criteria against a second agent run.** The confirmation UI shows the evidence from the most recent completed agent run. Triggering a new run to re-validate before approval is out of scope.

---

## 4. User Story

> As a reviewer, I open a card in the `review` column to evaluate the agent's output. I want to see exactly which acceptance criteria the agent ran and whether each passed or failed, and I want the system to require me to explicitly acknowledge that I have reviewed this evidence before my approval is recorded — so that my sign-off is meaningful and defensible.

**Scenario — happy path:**

1. Reviewer opens the Card Detail modal for a card with `agentStatus: pending-approval`.
2. The modal shows the card description, the agent run summary, and an "Approve" button (unchanged from today).
3. Reviewer clicks "Approve". Instead of immediately submitting, a confirmation UI appears.
4. The confirmation UI lists every acceptance criterion and its pass/fail result from the agent run, along with any evidence snippet the agent recorded.
5. A checkbox (or equivalent interaction) labelled "I have reviewed all acceptance criteria and the agent's evidence" is unchecked by default. The final "Confirm Approval" button is disabled until the checkbox is checked.
6. Reviewer reads the criteria, checks the box, and clicks "Confirm Approval".
7. `POST /api/cards/:id/approve` is called. The card moves to `terminal`. `approvedBy` and `approvedAt` are written server-side.

**Scenario — cancel:**

At step 4 or 5 the reviewer clicks "Cancel". The confirmation UI closes. The card detail modal is restored to its prior state. No API call is made. No state changes.

---

## 5. Acceptance Criteria

These are testable gates for the feature to be considered complete.

1. **Confirmation step is interposed.** Clicking "Approve" on a `review`-column card with `agentStatus: pending-approval` does not immediately call the approve API. It surfaces a confirmation UI first.

2. **All acceptance criteria are listed.** The confirmation UI renders every acceptance criterion defined on the card, paired with the pass/fail result recorded in the most recently completed `AgentRun`. If a criterion has no recorded evidence, the UI shows the criterion text with a "No evidence recorded" label rather than omitting it.

3. **Confirm button is gated on explicit acknowledgement.** The "Confirm Approval" button is rendered in a disabled state when the confirmation UI first appears. It becomes active only after the reviewer interacts with the confirmation element (e.g. checks the acknowledgement checkbox). It must not be possible to submit approval by pressing Enter or any keyboard shortcut that bypasses the checkbox.

4. **Cancel is side-effect-free.** Clicking "Cancel" at any point in the confirmation UI returns the reviewer to the card detail modal in exactly the same state it was in before "Approve" was clicked. No API call is issued. The card's column, `agentStatus`, `approvedBy`, and `approvedAt` are unchanged.

5. **"Request Revision" is unaffected.** The confirmation step does not appear on the "Request Revision" path. Clicking "Request Revision" continues to open the existing revision reason input directly, with no interstitial confirmation UI.

6. **`approvedBy` and `approvedAt` are server-side only.** The confirmation UI adds no new fields to the request body of `POST /api/cards/:id/approve`. The server continues to derive `approvedBy` from `session.user.githubUsername` and `approvedAt` from the server clock, as specified in the parent PRD (§5.1).

7. **Optimistic rollback is preserved.** If the approve API call fails after confirmation, the card reverts to its pre-approval column and status in the UI without a page refresh, consistent with the parent PRD (§4.2 AC5).

8. **Confirmation is not shown for cards not awaiting approval.** Cards in any column other than `review`, or with any `agentStatus` other than `pending-approval`, do not render the "Approve" button at all. The confirmation UI cannot be reached for such cards.

---

## 6. Open Questions

1. **Modal-within-modal or inline replacement?** The confirmation UI could be a second modal layered over the card detail modal, or it could replace the action buttons inline within the existing modal (expanding a panel below them). A nested modal is simpler to implement and clearly scopes the confirmation context, but layered modals can be disorienting. An inline expansion avoids the layering problem but requires more layout work. Which approach does the design team prefer?

2. **Per-criterion reviewer checkboxes.** While per-criterion sign-off is explicitly a non-goal for v1 (§3), should the UI make individual criteria checkable as a low-effort enhancement — even if all boxes are required before confirmation? This would produce a stronger audit trail at the cost of more clicks for cards with many criteria. Worth re-evaluating before implementation begins.

3. **Reviewer note on approval.** Should the reviewer be able to optionally attach a short plain-text note at confirmation time (e.g. "Checked against staging — looks good")? The note would be stored on the `AgentRun` or `Card` record and surfaced in the card detail. This adds minimal UI complexity but requires a schema change and a new optional field in the approve request body (handled server-side, not user-supplied attribution). Decide before the tech spec is written.

4. **What if the agent run has no criteria evidence?** A card may have been manually moved to `review` by an operator without an agent run completing, or the agent run may have recorded no evidence (e.g. it timed out). The confirmation UI must handle this gracefully (AC2 notes "No evidence recorded"). Should approving a card with no agent run evidence be blocked, warned, or silently permitted? A warning feels appropriate; a hard block may be too strict for operator overrides.

5. **Confirmation element choice.** An acknowledgement checkbox is the most accessible and familiar pattern. An alternative is a typed confirmation (e.g. type "APPROVE" to proceed), which is harder to do accidentally but is significantly more friction and unfriendly for routine approvals. Is the checkbox sufficient, or does the team want stronger confirmation mechanics for high-stakes cards?
