# Approval Confirmation Step — Technical Specification

**Feature:** Approval Confirmation Step  
**Parent:** [Approval Workflow](./TECH_SPEC.md)  
**Status:** ✅ Shipped  
**Date:** 2026-04-14

---

## Overview

The approval confirmation step interposes a review UI between clicking
"Approve" and the actual `POST /api/cards/:id/approve` call. The reviewer
must examine acceptance criteria evidence and explicitly acknowledge review
via a checkbox before the approval is submitted.

---

## 1. Component

### `PendingApprovalActions` — inside `CardDetailModal.tsx`

Renders when `card.agentStatus === 'pending-approval'`.

**States:**

| State | Type | Purpose |
|-------|------|---------|
| `showConfirmation` | `boolean` | Show/hide the review modal |
| `confirmed` | `boolean` | Checkbox acknowledgement state |
| `approving` | `boolean` | API call in-flight |
| `revisionNote` | `string` | Revision reason text |

---

## 2. Approval Flow

1. **Initial view:** "Request Revision" and "Approve & Close" buttons.
2. **Click "Approve & Close":** Confirmation modal appears.
3. **Confirmation modal displays:**
   - All acceptance criteria with pass/fail results and evidence from the
     most recent completed `AgentRun`.
   - Scrollable list when criteria count >= 7.
   - Checkbox: *"I have reviewed all acceptance criteria and confirm this
     work meets the requirements."*
   - "Back" button to cancel; "Approve" button disabled until checkbox
     is checked.
4. **Check box + click "Approve":** Calls `approveCard(cardId)` from the
   Zustand store → `POST /api/cards/{cardId}/approve`.
5. **On success:** Modal closes. Card moves to terminal column (server
   sets `approvedBy` from session, `approvedAt` from server clock).

---

## 3. Revision Flow

1. Click "Request Revision" → inline textarea appears for reason.
2. User enters reason (validated non-empty on client).
3. Submit calls `requestRevision(cardId, reason)` →
   `POST /api/cards/{cardId}/request-revision` with `{ reason }`.
4. Card moves to revision column. Modal closes.

---

## 4. API Endpoints

Both endpoints are defined in the parent [Approval Workflow TECH_SPEC](./TECH_SPEC.md):

- `POST /api/cards/{id}/approve` — no request body; `approvedBy` set
  server-side from session.
- `POST /api/cards/{id}/request-revision` — body: `{ reason: string }`.

No new API routes were added for the confirmation step itself — it is
purely a frontend gate.

---

## 5. Acceptance Criteria (from PRD)

1. Clicking "Approve" opens confirmation UI, does not immediately call API.
2. All acceptance criteria listed with pass/fail evidence.
3. "Approve" button disabled until acknowledgement checkbox is checked.
4. "Back" / cancel returns to card detail with no side effects.
5. "Request Revision" path is unaffected (no confirmation interstitial).
6. `approvedBy` and `approvedAt` remain server-side only.
