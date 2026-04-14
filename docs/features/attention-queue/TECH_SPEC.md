# Attention Queue — Technical Specification

**Feature:** Attention Queue  
**Status:** ✅ Shipped  
**Date:** 2026-04-14

---

## Overview

The Attention Queue (`/attention`) aggregates cards requiring immediate human
action across all boards. It surfaces four card states: **failed**, **blocked**,
**revision needed** (evaluation-failed), and **pending approval**. Each card
displays contextual information and offers inline actions.

---

## 1. Page Structure

### `app/attention/page.tsx`

Server component that dynamically imports the client component with SSR
disabled.

### `app/attention/_components/AttentionQueueClient.tsx`

Client component responsible for data fetching, filtering, grouping, and
rendering.

**Data flow:**

1. On mount, calls `fetchBoards()` from the Zustand store to get all boards.
2. For each board, calls `fetchBoard(boardId)` to load cards and columns.
3. Filters cards where `agentStatus` is one of:
   - `failed`
   - `blocked`
   - `evaluation-failed`
   - `pending-approval`
4. Groups filtered cards by status and renders each group with a count header.
5. Empty state shown when no cards need attention.

---

## 2. Card Display

Each card in the queue shows:

| Element | Source |
|---------|--------|
| Status badge | `AgentStatusBadge` component |
| Urgency flag | "URGENT" for blocked cards older than 1 hour |
| Time elapsed | Duration since agent run started |
| Card title | Clickable — opens `CardDetailModal` |
| Board path | `Board / Column` breadcrumb |
| Context summary | Status-specific (see below) |

**Context summary by status:**

| Status | Summary content |
|--------|----------------|
| `blocked` | First 120 chars of `blockedReason` |
| `evaluation-failed` | Count of failed acceptance criteria |
| `pending-approval` | "All criteria passed. Awaiting human approval." |
| `failed` | Generic failure indicator |

**Visual styling:**

| Status | Border/background |
|--------|-------------------|
| Blocked + urgent (>1h) | Red border, red background tint |
| Blocked + normal | Amber border, dark background |
| Evaluation failed | Rose border |
| Pending approval | Violet border |

---

## 3. User Actions

### Blocked cards
- **Reply** — opens `CardDetailModal` for replying to the agent
- **Connect via CLI** — displays session connection command

### Evaluation-failed cards
- **View evaluation** — opens `CardDetailModal` showing criteria results

### Pending-approval cards
- **Approve** — calls `approveCard(cardId)` via Zustand store
- **Request revision** — opens inline textarea, validates non-empty input,
  calls `requestRevision(cardId, reason)` via store

---

## 4. API Integration

The Attention Queue has no dedicated API route. It uses existing endpoints
through Zustand store actions:

| Action | Store method | API endpoint |
|--------|-------------|-------------|
| Approve | `approveCard(cardId)` | `POST /api/cards/{cardId}/approve` |
| Request revision | `requestRevision(cardId, reason)` | `POST /api/cards/{cardId}/request-revision` |
| Load data | `fetchBoards()` / `fetchBoard(id)` | `GET /api/boards` / `GET /api/boards/{id}` |

After any action, the store refetches the board to sync state from the server.

---

## 5. Navigation

- Linked from `NotificationBell` footer ("View all" → `/attention`).
- `TopNav` renders "Attention" breadcrumb on the page.
