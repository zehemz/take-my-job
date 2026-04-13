# API Layer — Technical Spec

**Status:** ✅ Shipped
**Implemented:** 2026-04-13

---

## Overview

REST API layer connecting the Next.js frontend to the Prisma/PostgreSQL backend.
All type contracts live in `lib/api-types.ts` — import from there to stay in
sync.

---

## Endpoints

| Method | Route | Handler | Purpose |
|--------|-------|---------|---------|
| GET | `/api/boards` | `app/api/boards/route.ts` | List all boards |
| GET | `/api/boards/[id]` | `app/api/boards/[id]/route.ts` | Board + columns + cards + runs |
| POST | `/api/boards/[id]/cards` | `app/api/boards/[id]/cards/route.ts` | Create card |
| GET | `/api/cards/[id]` | `app/api/cards/[id]/route.ts` | Single card |
| PATCH | `/api/cards/[id]` | `app/api/cards/[id]/route.ts` | Update card fields |
| DELETE | `/api/cards/[id]` | `app/api/cards/[id]/route.ts` | Delete card |
| POST | `/api/cards/[id]/move` | `app/api/cards/[id]/move/route.ts` | Move to column |
| GET | `/api/events/[cardId]` | `app/api/events/[cardId]/route.ts` | SSE stream |

---

## Schema extensions (migration 0002)

Added alongside the API layer:

- `Column.columnType: ColumnType` — enum replacing two-boolean column state
- `Card.movedToColumnAt: DateTime?` — set on every move
- `Card.revisionContextNote: String?` — human note when sending card back
- `Card.approvedBy: String?` — GitHub username of approver (set server-side)
- `Card.approvedAt: DateTime?` — approval timestamp
- `AgentRun.columnId: String?` — column that triggered the run

---

## Key design decisions

### Status mapping (`lib/api-mappers.ts`)

DB `AgentRunStatus` (7 values) is mapped to frontend `AgentStatus` (8 values):

- `pending / idle / cancelled` → `idle`
- `running` → `running`
- `blocked` → `blocked`
- `failed` → `failed`
- `completed` + all criteria passed → `completed`
- `completed` + any criterion failed → `evaluation-failed`

### Broadcaster singleton (`lib/broadcaster-singleton.ts`)

Uses `globalThis.__kobani_broadcaster` to survive Next.js hot-reloads in dev.
The same instance is shared between the orchestrator (which emits) and the SSE
route (which subscribes).

### SSE (`/api/events/[cardId]`)

Returns `text/event-stream`. Each event is `data: <json>\n\n`. Sends a
`: connected` heartbeat comment on open. Unsubscribes on request abort.

**Auth note (pending):** `EventSource` does not send cookies by default.
Frontend must use `withCredentials: true` or a fetch-based SSE approach once
auth is added. The route must also call `auth()` server-side.

---

## Dependencies added

None — uses existing Prisma, Next.js, and Node.js primitives.
