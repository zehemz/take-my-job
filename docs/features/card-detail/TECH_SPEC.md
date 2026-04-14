# Card Detail View — Technical Specification

**Feature:** Card Detail View  
**Status:** ✅ Shipped  
**Date:** 2026-04-14

---

## Overview

The Card Detail modal (`CardDetailModal`) is the primary workspace for
inspecting and interacting with a card. It supports inline editing, live agent
output streaming over SSE, approval and revision workflows, blocked-state
replies, and card deletion.

---

## 1. Component

### `app/boards/[id]/_components/CardDetailModal.tsx`

Client component opened via Zustand `openCardDetail(cardId)`.

**Lifecycle:**

1. On open, fetches `GET /api/cards/{cardId}` for fresh data.
2. If the card is live (`running` or `evaluating`), opens an SSE connection at
   `new EventSource('/api/events/{cardId}')`.
3. Merges API card data with SSE output into display state.
4. On close, tears down SSE connection and calls `closeCardDetail()`.

---

## 2. Sections (top to bottom)

### Header
- Title (clickable for inline edit in inactive columns)
- `AgentStatusBadge`
- Time-in-column display
- GitHub context line (`owner/repo · branch`) when set

### Meta row
- Agent role pill, attempt count, run start time
- Approved-by attribution when `approvedBy` and `approvedAt` are set

### Description
- Read-only by default; inline edit in inactive columns

### Blocked banner
- Renders when `agentStatus === 'blocked'` and `blockedReason` is set
- Shows blocked reason text
- Reply textarea + "Send to agent" button
- CLI attach command with copy button

### Acceptance criteria
- `AcceptanceCriteriaList` component
- Read-only in view mode; editable (add/remove/edit) in inactive columns
- Pass/fail status with evidence from agent evaluation

### Agent output
- `AgentOutputPanel` with blinking cursor during live streaming
- SSE connection indicator (Live / Reconnecting / Disconnected)
- Previous runs in collapsible `<details>` sections

### Retry schedule panel
- Renders when `agentStatus === 'failed'`
- Shows retry timing or permanent failure state
- "Retry now" button → `POST /api/cards/{cardId}/retry`

### Revision context form
- Renders when column type is `revision`
- Textarea for adding context for the next agent attempt

### Pending approval actions
- Renders when `agentStatus === 'pending-approval'`
- Two-step approval confirmation (see Approval Confirmation TECH_SPEC)
- Request revision with reason input

### Footer
- Delete card affordance (two-step inline confirmation)
- Last updated timestamp

---

## 3. SSE Integration

| SSE event | Update behavior |
|-----------|-----------------|
| `agent_message` | Appends to output panel text buffer |
| `status_change` / `card_update` | Triggers card refetch |
| `done` | Closes SSE stream, refetches card |

Reconnect: exponential backoff (1s → 2s → 4s → 8s, cap 30s). After 3
failures, transitions to disconnected state.

---

## 4. Inline Editing

Editing is available only when the card is in an **inactive** column.

| Field | Edit control | Save mechanism |
|-------|-------------|---------------|
| Title | Text input | `PATCH /api/cards/{id}` |
| Description | Textarea | `PATCH /api/cards/{id}` |
| Acceptance criteria | List with add/remove/edit | `PATCH /api/cards/{id}` |
| Role | Select dropdown (auto-saves on change) | `PATCH /api/cards/{id}` |
| GitHub repo/branch | Text inputs | `PATCH /api/cards/{id}` |

Each field edits independently — no global edit mode. Save/Cancel buttons
per field. Escape cancels; clicking outside cancels.

---

## 5. Delete Card

Two-step inline confirmation in the footer:

1. Click "Delete card" → footer expands to "Delete permanently" / "Keep"
2. Confirm fires `DELETE /api/cards/{id}`
3. Modal closes optimistically; card removed from Zustand store
4. On failure, card is re-inserted with error note

Blocked while `agentStatus === 'running'` (inline message instead of
confirmation step).

---

## 6. API Routes Used

| Method | Endpoint | Purpose |
|--------|---------|---------|
| `GET` | `/api/cards/{id}` | Fetch card data |
| `PATCH` | `/api/cards/{id}` | Update card fields |
| `DELETE` | `/api/cards/{id}` | Delete card |
| `POST` | `/api/cards/{id}/retry` | Trigger manual retry |
| `POST` | `/api/cards/{id}/approve` | Approve card |
| `POST` | `/api/cards/{id}/request-revision` | Request revision |
| `POST` | `/api/cards/{id}/reply` | Reply to blocked agent |
| SSE | `/api/events/{cardId}` | Live agent output stream |
