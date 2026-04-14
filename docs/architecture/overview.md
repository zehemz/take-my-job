# Kobani — System Architecture Overview

## What it is

Kobani is an AI-powered Kanban board. Cards represent units of work. When a card
is moved into an **active** column, the orchestrator automatically dispatches an
AI agent to complete the work. The agent streams its progress back to the UI in
real time via SSE.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5.8 |
| Database | PostgreSQL via Prisma 6 |
| AI | Anthropic Managed Agents SDK |
| State (client) | Zustand 5 |
| Drag-and-drop | dnd-kit |
| Styling | Tailwind CSS 3.4 |
| Testing | Vitest 4 |

---

## Data flow

```
Browser (React + Zustand)
  │
  │  REST (lib/api-types.ts contract)
  ▼
Next.js API Routes  (app/api/**)
  │                          │
  │ Prisma                   │ SSE (text/event-stream)
  ▼                          ▼
PostgreSQL            Broadcaster singleton
                       (lib/broadcaster-singleton.ts)
                              ▲
                              │ emit()
                       Orchestrator poll loop
                       (lib/orchestrator.ts)
                              │
                              │ spawns
                       Agent Runner
                       (lib/agent-runner.ts)
                              │
                              │ Anthropic Managed Agents SDK
                              ▼
                       Anthropic API (sessions, streaming)
```

---

## Key modules

| Module | Purpose |
|--------|---------|
| `lib/orchestrator.ts` | Poll loop — finds eligible cards, dispatches runners |
| `lib/agent-runner.ts` | Manages a single agent session end-to-end |
| `lib/broadcaster.ts` | In-process pub/sub; fans out agent events to SSE subscribers |
| `lib/broadcaster-singleton.ts` | Shared instance across hot-reloads (globalThis) |
| `lib/db-queries.ts` | Typed Prisma query layer implementing `IDbQueries` |
| `lib/api-types.ts` | HTTP API contract — all request/response shapes |
| `lib/api-mappers.ts` | DB model → API response converters, status mapping |
| `lib/kanban-types.ts` | Frontend types (AgentStatus, ColumnType, etc.) |
| `lib/types.ts` | Backend types mirroring Prisma schema |

---

## API surface

All routes are defined under `app/api/`. See `lib/api-types.ts` for the full
type contract.

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/boards` | List all boards |
| GET | `/api/boards/[id]` | Board detail with columns, cards, and agent runs |
| POST | `/api/boards/[id]/cards` | Create a card |
| GET | `/api/cards/[id]` | Single card with runs |
| PATCH | `/api/cards/[id]` | Update card fields |
| DELETE | `/api/cards/[id]` | Delete card |
| POST | `/api/cards/[id]/move` | Move card to a different column |
| GET | `/api/events/[cardId]` | SSE stream for real-time agent events |

---

## Agent lifecycle

```
Card enters active column
  → Orchestrator picks it up (next poll tick)
  → AgentRun created (status: pending)
  → Agent session created with Anthropic
  → Events stream: agent_message, tool_use, card_update, ...
  → Agent calls update_card(completed) → card moved, run marked completed
  → OR agent calls update_card(blocked) → human input required
  → OR max retries exhausted → run marked failed
```

---

## Key constraints

- **MAX_CONCURRENT_AGENTS** — limits parallel agent sessions (default: 3)
- **MAX_TURNS** — max agent turns before marking failed
- **MAX_RETRY_BACKOFF_MS** — exponential backoff cap for retries
- **Broadcaster is in-process** — SSE only works in single-process deployments (dev/single-instance prod). Multi-instance needs Redis pub/sub.

---

## Auth (planned)

GitHub OAuth via NextAuth.js v5. Username whitelist via `ALLOWED_GITHUB_USERS`
env var. See [features/auth/](../features/auth/) for full specs.
