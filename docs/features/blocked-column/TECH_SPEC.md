# Blocked Column + Human Reply — Technical Specification

**Feature:** Blocked Column with Human Reply  
**Status:** ✅ Shipped  
**Date:** 2026-04-14

---

## Overview

When an agent signals that it is blocked and needs human input, the card moves
to a dedicated `blocked` column. A human can reply to the agent directly from
the card detail UI or connect to the live session via the CLI. The reply
resumes the agent session and moves the card back to an active column.

---

## 1. Schema Change

### `prisma/schema.prisma`

Added `blocked` to the `ColumnType` enum:

```prisma
enum ColumnType {
  inactive
  active
  review
  revision
  blocked    // new
  terminal
}
```

Migration: `prisma/migrations/20260414_add_blocked_column_type/`

---

## 2. API Route

### `POST /api/cards/[id]/reply` — `app/api/cards/[id]/reply/route.ts`

**Auth:** `devAuth()` guard; returns `401` if no session.

**Request body:**

```ts
{ message: string }
```

**Logic:**

1. Validate card exists; return `404` if not found.
2. Verify card is in a column with `columnType === 'blocked'`; return `400`
   otherwise.
3. Find the blocked `AgentRun` (status `'blocked'` with a `sessionId`);
   return `400` if not found.
4. Send message to the live Anthropic session:
   `anthropicClient.sendMessage(sessionId, { type: 'user.message', content: message })`.
5. Update the `AgentRun`: status `'blocked'` → `'running'`, clear
   `blockedReason`.
6. Move the card from the blocked column to the board's active column.
7. Call `orchestrator.notifyCardUnblocked()` to re-attach the event loop.
8. Return the updated card.

**Validations:**

- Card must be in a `blocked` column type.
- Must have an active blocked run with a `sessionId`.
- Board must have an active column to move the card to.

---

## 3. Column UI

### `app/boards/[id]/_components/Column.tsx`

- Blocked column header shows a pulsing amber dot indicator when cards are
  present.
- Column styled with amber coloring to signal attention needed.

---

## 4. Card Detail Integration

### `BlockedBanner` in `CardDetailModal.tsx`

Renders when `agentStatus === 'blocked'`:

- Displays `blockedReason` text from the agent.
- Reply textarea with "Send to agent" button → calls `POST /api/cards/{id}/reply`.
- CLI attach command display (`ant sessions connect {sessionId}`) with copy
  button for direct session access.

---

## 5. Orchestrator Integration

When a card is unblocked via reply:

- `orchestrator.notifyCardUnblocked()` re-attaches the SSE event loop to the
  resumed session.
- The agent continues processing in the same session (no new session created).
- Card moves to active column and the agent run status changes to `running`.
