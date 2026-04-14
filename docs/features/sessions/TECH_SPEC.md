# Sessions List — Technical Specification

**Feature:** Sessions List  
**Status:** ✅ Shipped  
**Date:** 2026-04-14

---

## Overview

The Sessions List page (`/sessions`) displays live Anthropic managed agent
sessions correlated with local Kobani `AgentRun` records. It gives operators
real-time visibility into which sessions are active on the Anthropic platform
and how they map to cards on the board.

---

## 1. API Route

### `GET /api/sessions` — `app/api/sessions/route.ts`

**Auth:** `devAuth()` guard; returns `401` if no session.

**Logic:**

1. Fetch all live sessions from the Anthropic Beta Sessions API via
   `anthropicClient.beta.sessions.list()`.
2. Query all `AgentRun` records that have a non-null `sessionId` from the
   local database, including their related `Card` (with `boardId`).
3. For each Anthropic session, look up the matching `AgentRun` by `sessionId`
   to correlate with a Kobani card.
4. Build a `SessionRow[]` response, sorted by `createdAt` descending (newest
   first).

**Response shape:** `SessionRow[]` (see §3).

---

## 2. Page and Components

### `app/sessions/page.tsx`

Client component. Fetches `/api/sessions` on mount. Renders loading state,
error state, or delegates to `SessionTable`.

- Handles `401` by redirecting to `/login`.
- Breadcrumb navigation shows "Sessions" via `TopNav`.

### `app/sessions/_components/SessionTable.tsx`

Renders a styled table with the following columns:

| Column | Source |
|--------|--------|
| Status | `SessionStatus` badge (color-coded) |
| Title | `session.title` |
| Agent | `session.agentName` |
| Environment | `session.environmentId` (copyable via `CopyableCell`) |
| Card | Link to board when `cardId` and `boardId` are set |
| Role | `agentRole` from correlated `AgentRun` |
| Created | `session.createdAt` |

**Status badge colors:**

| Status | Color |
|--------|-------|
| `running` | Blue |
| `idle` | Gray/zinc |
| `terminated` | Dark/dim |
| `rescheduling` | Amber |

**`CopyableCell`:** Renders the environment ID with a clipboard copy button.
Visual feedback on copy (brief confirmation).

**Empty state:** Message shown when no sessions are found.

---

## 3. Types — `lib/api-types.ts`

```ts
export type SessionStatus = 'rescheduling' | 'running' | 'idle' | 'terminated';

export interface SessionRow {
  id: string;
  title: string | null;
  status: SessionStatus;
  agentName: string;
  agentId: string;
  environmentId: string;
  createdAt: string;
  updatedAt: string;
  cardId: string | null;
  boardId: string | null;
  agentRole: string | null;
  agentRunStatus: string | null;
}
```

---

## 4. Navigation

- Link in `TopNav` for direct access to `/sessions`.
- Breadcrumb displays "Sessions" when on the page.
