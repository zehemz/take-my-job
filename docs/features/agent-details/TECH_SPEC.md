# Agent Details View — Technical Specification

**Feature:** Agent Details View  
**Status:** ✅ Shipped  
**Date:** 2026-04-14

---

## Overview

The Agent Details page (`/agents/[id]`) displays full configuration and sync
status for a single Anthropic managed agent. It retrieves live data from the
Anthropic API and correlates with the local `AgentConfig` database record.

---

## 1. API Route

### `GET /api/agents/[id]` — `app/api/agents/[id]/route.ts`

**Auth:** `devAuth()` guard; returns `401` if no session.

**Logic:**

1. Retrieve agent from Anthropic Beta SDK: `agents.retrieve(id)`.
2. Look up local DB record: `agentConfig.findFirst({ anthropicAgentId: id })`.
3. Derive `syncStatus`:
   - `'healthy'` — DB record exists and agent is active on Anthropic.
   - `'orphaned'` — agent has `archived_at` set on Anthropic.
   - `'unmapped'` — agent exists on Anthropic but has no local DB record.
4. Return `AgentDetail` (see §3).

### `DELETE /api/agents/[id]`

Archives the agent on Anthropic and cleans up the local DB record. Handles
cases where Anthropic delete fails gracefully (still removes DB record).

---

## 2. Page Component

### `app/agents/[id]/page.tsx`

Client component. Fetches agent detail on mount.

**Display:**

- Title and sync status badge
- Field grid: Status, Role, Model, Version, Agent ID (copyable), Created at,
  Archived at, Description
- Loading skeleton during fetch
- 404 state for missing agents
- Error state with retry button
- Back link (`← Agents`) to `/agents`

**Sync status badge colors:**

| Status | Color |
|--------|-------|
| `healthy` | Green |
| `unmapped` | Amber |
| `orphaned` | Red |

---

## 3. Types — `lib/api-types.ts`

```ts
export type AgentSyncStatus = 'healthy' | 'unmapped' | 'orphaned';

export interface AgentDetail {
  anthropicAgentId: string;
  name: string;
  model: string;
  anthropicVersion: string;
  role: string | null;
  dbId: string | null;
  syncStatus: AgentSyncStatus;
  description: string | null;
  createdAt: string;
  archivedAt: string | null;
}
```

---

## 4. Navigation

- Clicking an agent name on `/agents` navigates to `/agents/[id]`.
- Back link on detail page returns to `/agents`.
