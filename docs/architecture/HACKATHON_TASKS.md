# Kobani — Hackathon Task Breakdown

> 4 engineers, 1 day. Stack: Next.js 14, TypeScript, Prisma, SQLite, Anthropic Managed Agents SDK, Tailwind, dnd-kit.

---

## Hour 0 — All 4 together (~1h)

Write and merge `lib/types.ts`, `lib/interfaces.ts`, and `lib/stubs/` before splitting.
This is the only synchronisation point. After this, everyone works independently.

**Deliverables:**
- `lib/types.ts` — plain TS entity types (Card, Column, AgentRun, AgentConfig, Board)
- `lib/interfaces.ts` — IDbQueries, IAnthropicClient, IBroadcaster, IOrchestrator
- `lib/stubs/db-queries.stub.ts` — in-memory IDbQueries
- `lib/stubs/anthropic-client.stub.ts` — scriptable fake with canned event sequences
- `lib/stubs/broadcaster.stub.ts` — records emitted events
- `lib/stubs/orchestrator.stub.ts` — records notifyCardMoved calls

---

## Engineer 1 — Foundation

> Ship in this order — each piece unblocks E2/E3 as a separate PR.

### Task 1.1 — Project scaffold
`package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `app/layout.tsx`, `app/globals.css`

### Task 1.2 — Prisma schema + DB client ← unblocks E2, E3
`prisma/schema.prisma` — Board, Column, Card, AgentRun (with `columnId` FK), AgentConfig, AgentRunStatus enum  
`lib/db.ts` — Prisma client singleton  
`prisma/seed.ts` — seed one board with Backlog / In Progress / Review / Done columns

### Task 1.3 — DB query helpers ← unblocks E2 dispatch, E3 AgentRun writes
`lib/db-queries.ts` — implements `IDbQueries`:
- `getEligibleCards(maxConcurrent, claimedIds)`
- `createAgentRun(cardId, columnId, role, attempt)`
- `updateAgentRunStatus(id, status, extra?)`
- `appendAgentRunOutput(id, chunk)` — append-only
- `getAgentConfig(role)`
- `getRunningRuns()`
- `getCard(id)` — includes column
- `moveCard(cardId, newColumnId)`
- `getRetryEligibleRuns()`
- `getColumnByName(boardId, name)`

### Task 1.4 — Anthropic client wrapper ← unblocks E3 real sessions
`lib/anthropic-client.ts` — implements `IAnthropicClient`:
- `createSession(config)` — wraps `client.beta.sessions.create`
- `streamSession(sessionId)` — returns async iterable of typed events
- `sendMessage(sessionId, msg)` — wraps `client.beta.sessions.events.send`
- `retrieveSession(sessionId)`
- `interruptSession(sessionId)`

### Task 1.5 — Config + env
`lib/config.ts` — reads all 9 env vars, validates ranges, exports typed constants  
`.env.example`

### Task 1.6 — Setup script ← run once before demo
`scripts/setup-agents.ts` — idempotent: creates one Anthropic agent per role + shared environment, writes to AgentConfig table

---

## Engineer 2 — Orchestrator

> Builds against stubs. Swap to real IDbQueries/IAnthropicClient as E1 PRs land.

### Task 2.1 — Orchestrator core
`lib/orchestrator.ts`:
- In-memory state: `running: Map<cardId, {run, abortController}>`, `claimed: Set<cardId>`
- `start()` — runs startup recovery then starts poll loop
- `stop()`
- `notifyCardMoved(cardId, newColumnId)` — implements `IOrchestrator`; cancels run if column is terminal/inactive

### Task 2.2 — Dispatch
`lib/orchestrator/dispatch.ts`:
- Query eligible cards via `IDbQueries.getEligibleCards`
- Enforce `MAX_CONCURRENT_AGENTS` cap
- For each candidate: `createAgentRun` → add to `claimed` → `spawnAgentRunner` (async, non-blocking)
- For retry-eligible failed runs: same flow with `attempt + 1`

### Task 2.3 — Reconcile
`lib/orchestrator/reconcile.ts`:
- `Promise.all` over all cards in `running` map — never serial
- Per card: check column (terminal/inactive → cancel), check session status via `retrieveSession`
- Stall detection: if `AgentRun.updatedAt` older than `MAX_STALL_MS` → treat as failed
- Outcomes: `terminated/success` → completed, `terminated/error` → schedule retry, `running/idle` → no-op

### Task 2.4 — Retry policy
`lib/orchestrator/retry.ts`:
- `scheduleRetry(run)` — sets `retryAfterMs = now + min(10000 * 2^(attempt-1), MAX_RETRY_BACKOFF_MS)`
- After `MAX_ATTEMPTS` → permanent failed, no retry

### Task 2.5 — Startup recovery
In `orchestrator.ts start()`:
1. Clear `running` + `claimed`
2. Fetch all `running`/`idle` AgentRuns → add to `claimed` synchronously
3. For each: retrieve session → if terminated, transition; if alive, re-attach runner
4. Fetch failed runs with `retryAfterMs < now` → reset to `now`
5. Only then: start poll loop

---

## Engineer 3 — Agent Runner

> `broadcaster` and `prompt-renderer` have zero deps — start immediately in hour 1.

### Task 3.1 — Broadcaster (start hour 1, no deps)
`lib/broadcaster.ts` — implements `IBroadcaster`:
- `emit(cardId, event)` — fan out to all subscribers for that card
- `subscribe(cardId, handler)` — returns unsubscribe function
- Clean up subscriptions when card has no more listeners

### Task 3.2 — Prompt renderer (start hour 1, no deps)
`lib/prompt-renderer.ts`:
- Renders the turn prompt template from §6.6 of SPEC.md
- Inputs: card, run, board columns, role display name
- Outputs board columns list with isActiveState/isTerminalState annotations
- Safe defaults: `githubBranch ?? 'main'`

### Task 3.3 — Workflow files (start hour 1, no deps)
`workflows/backend_engineer.md` — persona, task approach, when to call `update_card`, constraints (always write tests)  
`workflows/qa.md` — testing focus, edge cases, regression  
`workflows/tech_lead.md` — architecture, code review, trade-offs

### Task 3.4 — Agent runner core
`lib/agent-runner.ts`:
- `run(card, agentRun, deps)` — main entry point called by orchestrator
- Session create (§6.2): include `github_repository` resource if `card.githubRepoUrl` set
- Stream-first ordering (§6.3): open stream before/concurrently with first `sendMessage`
- Event loop (§6.4): consume until terminal; **do not break on bare `session.status_idle`**

### Task 3.5 — Event handlers
`lib/agent-runner/event-handler.ts`:

| Event | Action |
|---|---|
| `agent.message` | Append to output, broadcast `agent_message` |
| `agent.thinking` | Broadcast `agent_thinking` (not stored) |
| `agent.tool_use` | Broadcast `tool_use` |
| `agent.custom_tool_use` where name=`update_card` | → tools.ts handler |
| `session.status_idle` + `end_turn` | Mark completed, end loop |
| `session.status_idle` + `retries_exhausted` | Mark failed, end loop |
| `session.status_idle` + `requires_action` | Wait for tool result dispatch, continue loop |
| `session.status_terminated` | Exit loop, resolve outcome |
| `session.error` | Log, mark failed, end loop |
| `span.model_request_end` | Accumulate token usage |

### Task 3.6 — update_card tool
`lib/agent-runner/tools.ts`:
- `in_progress`: append summary to output, broadcast `card_update`, return `{success:true}`
- `completed`: validate `next_column` exists in board (return `{success:false,reason:...}` if not), validate all `criteria_results` passed (return rejection if any failed), move card, mark AgentRun completed, broadcast `card_update` + `status_change`
- `blocked`: store `blockedReason`, set status=blocked, broadcast `card_blocked` (with `cli_command` from `CLI_ATTACH_COMMAND_TEMPLATE`), return `{success:true}`, **exit event loop** — do not send further messages until human message arrives

### Task 3.7 — MAX_TURNS continuation
In event loop: track turn count. If session goes `end_turn` idle without `update_card(completed)` and turns < `MAX_TURNS`, send continuation message. If `MAX_TURNS` reached → mark failed.

---

## Engineer 4 — API + UI

> Static components start immediately in hour 1. Wire to real backend as E2+E3 integrate.

### Task 4.1 — API: board routes
`app/api/boards/route.ts` — `GET` (list boards), `POST` (create board + default columns)  
`app/api/boards/[id]/route.ts` — `GET` board with columns + cards + latest AgentRun per card

### Task 4.2 — API: card move
`app/api/cards/[id]/move/route.ts` — `PUT`:
1. Validate `columnId` exists on same board
2. Update `card.columnId` in DB
3. Call `orchestrator.notifyCardMoved(cardId, newColumnId)`
4. Return updated card

### Task 4.3 — API: SSE stream
`app/api/cards/[id]/events/route.ts` — `GET`:
- Returns SSE response (`text/event-stream`)
- Subscribes to `broadcaster` for `cardId`
- Forwards each event as `data: <json>\n\n`
- Unsubscribes on client disconnect
- Sends `done` event when AgentRun reaches terminal state

### Task 4.4 — API: human message (unblock)
`app/api/cards/[id]/message/route.ts` — `POST { text }`:
1. Find active AgentRun with status `blocked` or `idle`
2. Call `anthropicClient.sendMessage(sessionId, {type:'user.message', ...})`
3. Set AgentRun status back to `running`

### Task 4.5 — API: card CRUD
`app/api/cards/route.ts` — `POST` create card  
`app/api/cards/[id]/route.ts` — `PATCH` update title/description/acceptanceCriteria/role/githubRepoUrl

### Task 4.6 — UI: Board page
`app/page.tsx` — list boards, link to each  
`app/boards/[id]/page.tsx` — fetch board + columns + cards server-side, render `<Board>`

### Task 4.7 — UI: Board component
`components/Board.tsx` — renders columns side by side, wraps with dnd-kit `DndContext`  
`components/Column.tsx` — droppable area, card list, column header  
On card drop into new column: call `PUT /api/cards/[id]/move`

### Task 4.8 — UI: Card component
`components/Card.tsx`:
- Title, description, role badge, status badge (colour-coded per AgentRunStatus)
- Streaming agent output section (append `agent_message` events)
- Collapsible thinking section (`agent_thinking` events)
- Acceptance criteria results when completed
- **Blocked state:** prominent "Blocked" badge, `blockedReason`, copy-attach-command CTA, optional text input to unblock via `POST /api/cards/[id]/message`
- **Running/idle state:** collapsible debug panel with truncated `sessionId` + copy-attach-command button

### Task 4.9 — UI: SSE hook
`lib/hooks/useEventSource.ts`:
- Opens `EventSource` to `/api/cards/[id]/events`
- Appends events to local state
- Closes on `done` event or component unmount
- Re-opens on card re-entering active column

### Task 4.10 — New card form
`components/NewCardForm.tsx` — title, description, acceptance criteria (markdown), role selector, optional GitHub URL + branch  
Calls `POST /api/cards`

### Task 4.11 — Orchestrator singleton wiring
`lib/orchestrator-instance.ts` — singleton that boots on first import, reads real `IDbQueries` + `IAnthropicClient` from E1  
Import in `app/api/cards/[id]/move/route.ts` to wire `notifyCardMoved`

---

## Integration order (who talks to whom first)

```
E1.1.2 schema merged
  → E2 swaps db stub → real
  → E3 swaps db stub → real

E1.1.4 anthropic client merged
  → E3 swaps anthropic stub → real sessions

E3 broadcaster merged
  → E4 wires SSE endpoint to real broadcaster

E2 + E3 integrate (orchestrator spawns runner end-to-end)
  → E4 calls real notifyCardMoved, sees live SSE in browser
```

---

## Done criteria

- [ ] Card dragged to "In Progress" → AgentRun created → agent streams output to card in real time
- [ ] Agent calls `update_card(completed)` → card moves to target column
- [ ] Agent calls `update_card(blocked)` → blocked badge shown, attach command copyable, unblock via text input resumes session
- [ ] Dragging card back to Backlog mid-run → session interrupted, output stops
- [ ] MAX_CONCURRENT=2 enforced — 3rd card waits until a slot opens
- [ ] Setup script runs idempotently
