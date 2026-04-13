# Kobani — System Specification

> A language-agnostic specification for a Kanban-driven agent orchestration system built on Anthropic Managed Agents. This document describes the architecture, data model, and behavioral contracts that any conforming implementation must satisfy. The reference implementation uses Next.js 14 (TypeScript), Prisma, and SQLite.

---

## 1. Overview

**Kobani** is a Kanban board that dispatches Claude managed agents to fulfill tasks. Each card on the board represents a unit of work. When a card enters an active column, the system automatically assigns a Claude agent with a specific organizational role (Backend Engineer, QA Engineer, Tech Lead) to work on the task. Agents operate autonomously, stream their output back to the card in real time, and transition the card to its next column when work is complete.

### Design Goal

> Manage work instead of supervising agents.

Teams interact with a familiar Kanban board. Column transitions—not manual prompts—drive agent dispatch. The orchestration layer handles concurrency, retries, session lifecycle, and real-time observability. This mirrors [Symphony](https://github.com/openai/symphony)'s core principle, substituting Anthropic Managed Agents for OpenAI Codex and Kanban columns for Linear issues.

### Key Differences from Symphony

| Symphony | Kobani |
|---|---|
| Work source: Linear GraphQL API | Work source: SQLite Kanban board |
| Agent runtime: Codex (JSON-RPC app-server over stdio) | Agent runtime: Anthropic Managed Agents (SSE over HTTPS) |
| Workspace: per-issue filesystem directory | Workspace: per-session Anthropic-hosted container |
| Workflow policy: WORKFLOW.md (YAML + Liquid template) | Workflow policy: TypeScript workflow objects + Markdown prompt files |
| Implementation: Elixir/OTP | Reference implementation: Next.js 14, TypeScript |

Orchestration semantics (concurrency cap, exponential backoff, state reconciliation, poll cadence) are preserved verbatim from Symphony's design.

---

## 2. Architecture

The system has five components. Each has a single responsibility and communicates through the data layer or in-process message passing.

```
┌─────────────────────────────────────────────────────────┐
│                       Kanban Board UI                    │
│   Column transitions → card moves → API routes          │
│   Real-time agent output ← SSE stream per card          │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────┐
│                         API Layer                        │
│   /api/cards/[id]/move  — triggers orchestrator          │
│   /api/cards/[id]/events — SSE stream for UI             │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                       Orchestrator                       │
│   Poll loop (tick every N ms)                            │
│   Dispatch: fetch pending cards → create AgentRuns       │
│   Reconcile: check running sessions → handle state       │
│   Retry: exponential backoff on failure                  │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                      Agent Runner                        │
│   Creates Managed Agents session per card+role           │
│   Opens SSE stream (stream-first)                        │
│   Sends initial prompt (rendered from workflow)          │
│   Handles agent.message, agent.custom_tool_use events    │
│   Broadcasts output to SSE clients                       │
│   Reports completion/failure to orchestrator             │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS (Anthropic API)
┌──────────────────────────▼──────────────────────────────┐
│              Anthropic Managed Agents Platform           │
│   /v1/agents    — persisted agent configs per role       │
│   /v1/environments — shared container template           │
│   /v1/sessions  — per-card execution context             │
│   SSE event stream — agent output, tool use, status      │
└─────────────────────────────────────────────────────────┘
```

### 2.1 Component Responsibilities

**Kanban Board UI**
Renders boards, columns, and cards. Handles drag-and-drop column transitions. Opens one `EventSource` connection per card in an active column to display live agent output. Has no knowledge of agents or sessions.

**API Layer**
Thin HTTP handlers. Validates inputs, updates the database, and delegates side effects to the orchestrator or SSE broadcaster. Does not contain business logic.

**Orchestrator**
The single authority over which cards are running, which are waiting, and which should be dispatched next. Owns the in-memory dispatch state. Runs a poll loop that fires on a configurable interval. Modeled directly on Symphony's orchestrator GenServer.

**Agent Runner**
Executes one card assignment. Manages the full Managed Agents session lifecycle: session creation, stream connection, prompt delivery, event consumption, tool result handling, and output accumulation. Reports terminal state (completed/failed) back to the orchestrator.

**Anthropic Managed Agents Platform**
External service. The implementation must not make assumptions about its internal behavior beyond what is documented in the Managed Agents API specification.

---

## 3. Data Model

All state is stored in a relational database. The reference implementation uses SQLite via Prisma, but any SQL database is conforming.

### 3.1 Entities

#### Board
The root container for a set of columns and cards.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | PK, auto-generated | Unique identifier |
| `name` | String | required, max 255 | Display name |
| `createdAt` | DateTime | auto-set | Creation timestamp |
| `updatedAt` | DateTime | auto-updated | Last modification timestamp |

#### Column
An ordered lane within a board. Column `name` determines whether cards in it are eligible for agent dispatch (see §4.2).

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | PK, auto-generated | Unique identifier |
| `boardId` | String | FK → Board | Owning board |
| `name` | String | required, max 100 | Display name (e.g. "In Progress") |
| `position` | Int | ≥ 0, unique per board | Left-to-right ordering |
| `isActiveState` | Boolean | default false | Cards here are eligible for dispatch |
| `isTerminalState` | Boolean | default false | Cards here are "done"; clean up sessions |

A conforming board must have at least one `isActiveState` column and at least one `isTerminalState` column.

#### Card
A unit of work. The lifecycle of a card corresponds directly to Symphony's issue lifecycle.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | PK, auto-generated | Unique identifier |
| `boardId` | String | FK → Board | Owning board |
| `columnId` | String | FK → Column | Current column |
| `title` | String | required, max 255 | Short task description |
| `description` | String | optional | Full task description (Markdown) |
| `acceptanceCriteria` | String | optional | Newline-separated list of completion criteria (Markdown checkboxes). Each line is one criterion the agent must verify before calling `update_card(completed)`. |
| `role` | String | optional | Assigned workflow role for agent dispatch |
| `position` | Int | ≥ 0, unique per column | Top-to-bottom ordering within column |
| `githubRepoUrl` | String | optional | If set, agent session mounts this repo |
| `githubBranch` | String | optional | Branch to check out (default: repo default) |
| `createdAt` | DateTime | auto-set | |
| `updatedAt` | DateTime | auto-updated | |

#### AgentRun
Records one attempt by a managed agent to fulfill a card. A card may accumulate multiple AgentRuns across retries.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | PK, auto-generated | |
| `cardId` | String | FK → Card | The card being worked on |
| `role` | String | required | Workflow role (e.g. "backend_engineer") |
| `sessionId` | String | optional | Anthropic session ID once created |
| `status` | AgentRunStatus | required | See §3.2 |
| `output` | String | optional | Accumulated agent output (Markdown) |
| `criteriaResults` | String | optional | JSON array of `{ criterion, passed, evidence }` objects; populated when agent calls `update_card(completed)` |
| `blockedReason` | String | optional | Human-readable explanation when status=blocked |
| `attempt` | Int | ≥ 1 | Retry attempt number |
| `retryAfterMs` | Int | optional | When to retry (epoch ms); null if not retrying |
| `error` | String | optional | Error message if status=failed |
| `createdAt` | DateTime | auto-set | |
| `updatedAt` | DateTime | auto-updated | |

#### AgentConfig
Persists the Anthropic resource IDs created during one-time setup. The orchestrator reads these at runtime; it must never call `agents.create()` in the dispatch path.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | PK, auto-generated | |
| `role` | String | unique | Workflow role key |
| `anthropicAgentId` | String | required | Anthropic agent ID (`agent_...`) |
| `anthropicAgentVersion` | String | required | Pinned version at setup time |
| `anthropicEnvironmentId` | String | required | Shared environment ID (`env_...`) |
| `createdAt` | DateTime | auto-set | |

### 3.2 AgentRunStatus Enum

```
pending     → dispatched to agent runner, session not yet created
running     → session created, SSE stream open, agent is executing
idle        → session is idle; waiting for custom tool result
blocked     → agent called update_card(blocked); session is idle, awaiting human input
completed   → agent finished successfully; card moved to next column
failed      → terminal failure; eligible for retry or manual intervention
cancelled   → card moved out of active column before agent completed
```

A `blocked` run is distinct from a transient `idle`. It means the agent explicitly declared it cannot proceed without human intervention. The session remains live — a developer can attach to it via the CLI (see §13) or send a message through the card UI to unblock it.

---

## 4. State Machine

The Kanban column position is the source of truth for a card's state. Symphony uses Linear issue states; this system uses column membership.

### 4.1 Column State Semantics

| Column Type | Agent Action | Examples |
|---|---|---|
| Inactive (default) | None | "Backlog", "Ideas" |
| Active (`isActiveState=true`) | Dispatch agent on entry | "In Progress", "Review" |
| Terminal (`isTerminalState=true`) | Clean up sessions on entry | "Done", "Cancelled" |

A card entering an active column triggers orchestrator dispatch (subject to concurrency cap and existing AgentRun state). A card entering a terminal column cancels any running AgentRun.

### 4.2 Dispatch Eligibility

A card is eligible for dispatch if and only if:
- It is in an `isActiveState` column, AND
- It has no AgentRun with status `running` or `idle`, AND
- It has no AgentRun with `retryAfterMs` in the future

### 4.3 Card Lifecycle (Symphony §4 equivalent)

```
          User creates card
                │
           [Backlog]
                │  user drags to active column
         [In Progress] ──────────────────────────────────┐
                │  orchestrator dispatches                │
          AgentRun(pending)                               │
                │  session created                        │
          AgentRun(running)                               │
                │  agent finishes turn                    │
                ├── success → card moves to [Done]        │
                │   AgentRun(completed)                   │
                ├── failure → AgentRun(failed)            │
                │   retry scheduled (backoff)             │
                │   attempt+1 → back to dispatch          │
                └── user drags to [Done] or [Backlog]     │
                    AgentRun(cancelled) ◄─────────────────┘
```

---

## 5. Orchestrator

The orchestrator is the single authority over agent dispatch. It maintains in-memory state and reconciles against the database on each tick. Modeled directly on Symphony's orchestrator design.

### 5.1 In-Memory State

```
running: Map<cardId, { run: AgentRun, abortController: AbortController }>
claimed: Set<cardId>    // cards currently dispatched or queued (prevents double-dispatch)
```

State is intentionally volatile. On restart, the orchestrator recovers by reading AgentRun status from the database and reattaching to running sessions or scheduling retries.

### 5.2 Poll Loop

```
loop every POLL_INTERVAL_MS (default: 3000):
  1. reconcile_running()
  2. dispatch_pending()
```

The poll interval is configurable via environment variable. Minimum: 1000ms. Maximum: 30000ms.

### 5.3 Reconcile Running

For each card in `running` map:

1. Fetch the card's current column from the database.
2. If the card is now in a terminal column → cancel the session, set AgentRun status=cancelled, remove from `running` and `claimed`.
3. If the card is no longer in an active column → same as above.
4. Check Anthropic session status (`sessions.retrieve`):
   - `terminated` with successful outcome → mark AgentRun completed, move card to next column
   - `terminated` with error → schedule retry (see §5.5)
   - `running` or `idle` → no action (agent runner is handling it)

Stall detection: if an AgentRun has been `running` for more than `MAX_STALL_MS` (default: 3600000, 1 hour) with no output update, treat it as failed and schedule retry.

### 5.4 Dispatch Pending

```
candidates = SELECT cards WHERE column.isActiveState=true
             AND cardId NOT IN claimed
             ORDER BY card.position ASC, card.createdAt ASC
             LIMIT (MAX_CONCURRENT - len(running))

for each candidate:
  if candidate has no active AgentRun:
    create AgentRun(status=pending, attempt=1)
    add to claimed
    spawn agent_runner(card, run) // async, non-blocking
  elif candidate has AgentRun(failed, retryAfterMs < now):
    create AgentRun(status=pending, attempt=prev.attempt+1)
    add to claimed
    spawn agent_runner(card, run)
```

**Concurrency cap:** `MAX_CONCURRENT` (default: 5, configurable). The orchestrator never exceeds this number of simultaneously running AgentRuns.

### 5.5 Retry Policy (Symphony §6.2 equivalent)

Retry uses exponential backoff with a global cap:

```
delay_ms = min(10_000 * 2^(attempt - 1), MAX_RETRY_BACKOFF_MS)
MAX_RETRY_BACKOFF_MS = 300_000  (5 minutes)
MAX_ATTEMPTS = 5  (configurable)
```

| Attempt | Delay |
|---|---|
| 1 (first retry) | 10s |
| 2 | 20s |
| 3 | 40s |
| 4 | 80s |
| 5+ | 300s (capped) |

After `MAX_ATTEMPTS` failures, set AgentRun status=failed permanently and do not retry. Surface an error indicator on the card.

### 5.6 Startup Recovery

On application startup, before the first poll tick:
1. Query all AgentRuns with status `running` or `idle`.
2. For each: attempt to retrieve the Anthropic session. If terminated, transition to failed/completed per outcome. If still active, re-attach the agent runner.
3. Query all AgentRuns with status `failed` and `retryAfterMs < now`. Set retryAfterMs to `now` to make them immediately eligible.
4. Remove stale `claimed` state (all claimed entries from before the restart are now unclaimed).

---

## 6. Agent Runner

The agent runner manages the full lifecycle of one card assignment on the Anthropic Managed Agents platform.

### 6.1 Mandatory Flow (Anthropic Managed Agents invariant)

```
SETUP (once, at application startup):
  agents.create(role_config) → store anthropicAgentId + version in AgentConfig
  environments.create(env_config) → store anthropicEnvironmentId in AgentConfig

RUNTIME (per card dispatch):
  sessions.create(agent=agentId, environment_id=envId, ...) → sessionId
  open SSE stream (stream-first)
  sessions.events.send(user.message, prompt)
  consume stream until terminal
```

**The agent runner MUST NOT call `agents.create()` or `environments.create()` in the dispatch path.** These are one-time setup operations. The orchestrator reads pre-created IDs from `AgentConfig` and passes them to the agent runner.

### 6.2 Session Creation

```typescript
sessions.create({
  agent: { type: "agent", id: agentConfig.anthropicAgentId, version: agentConfig.anthropicAgentVersion },
  environment_id: agentConfig.anthropicEnvironmentId,
  title: `${run.role} — ${card.title} (attempt ${run.attempt})`,
  resources: card.githubRepoUrl ? [{
    type: "github_repository",
    url: card.githubRepoUrl,
    authorization_token: process.env.GITHUB_TOKEN,
    mount_path: "/workspace/repo",
    checkout: { type: "branch", name: card.githubBranch ?? "main" }
  }] : []
})
```

### 6.3 Stream-First Ordering

The SSE stream MUST be opened before or concurrently with the initial `sessions.events.send()` call. Sending the message before the stream is open may result in early events arriving in a single buffered batch, losing real-time streaming behavior.

```
stream = sessions.stream(sessionId)       // open stream
events.send(sessionId, user.message)      // send concurrently or immediately after
```

### 6.4 Event Handling

The agent runner consumes the SSE stream in a loop. Each event type requires a specific action:

| Event | Action |
|---|---|
| `agent.message` | Append content to `AgentRun.output`, broadcast to SSE clients |
| `agent.thinking` | Broadcast to SSE clients (not stored in output) |
| `agent.tool_use` | No action (built-in tool, handled by platform) |
| `agent.custom_tool_use` where `tool_name == "update_card"` | Execute card update (see §6.5), send `user.custom_tool_result` |
| `agent.custom_tool_use` for other tools | Execute tool, send result |
| `session.status_idle` where `stop_reason.type == "requires_action"` | Wait for `user.custom_tool_result` dispatch |
| `session.status_idle` where `stop_reason.type == "end_turn"` | Session complete → mark AgentRun completed |
| `session.status_idle` where `stop_reason.type == "retries_exhausted"` | Mark AgentRun failed → schedule retry |
| `session.status_terminated` | Exit loop; determine outcome from final session state |
| `session.error` | Log error; exit loop; mark failed |
| `span.model_request_end` | Accumulate token usage metrics |

**Do NOT break the loop on bare `session.status_idle`.** Break only when `stop_reason.type != "requires_action"`.

### 6.5 The `update_card` Custom Tool

This tool allows the agent to post structured progress updates back to the card. It is the primary mechanism for agent → board communication.

**Tool definition (on the agent):**
```json
{
  "type": "custom",
  "name": "update_card",
  "description": "Post a progress update or final result to the Kanban card. Use this to communicate what you have done and what remains. Call this at least once before completing your work. When status=completed, you MUST provide criteria_results for every acceptance criterion.",
  "input_schema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["in_progress", "completed", "blocked"],
        "description": "Current work status. Use 'blocked' only when you cannot proceed without human input."
      },
      "summary": {
        "type": "string",
        "description": "Markdown summary of work done so far or final result"
      },
      "next_column": {
        "type": "string",
        "description": "If status=completed, the name of the column to move the card to (e.g. 'Review', 'Done')"
      },
      "criteria_results": {
        "type": "array",
        "description": "Required when status=completed. One entry per acceptance criterion.",
        "items": {
          "type": "object",
          "properties": {
            "criterion": { "type": "string", "description": "The exact criterion text" },
            "passed": { "type": "boolean", "description": "Whether the criterion was met" },
            "evidence": { "type": "string", "description": "Brief proof: test output, command result, URL, etc." }
          },
          "required": ["criterion", "passed", "evidence"]
        }
      },
      "blocked_reason": {
        "type": "string",
        "description": "Required when status=blocked. Explain exactly what you need from a human to continue."
      }
    },
    "required": ["status", "summary"]
  }
}
```

**Agent runner behavior when this tool is called:**

| `input.status` | Behavior |
|---|---|
| `in_progress` | Append summary to `AgentRun.output`; broadcast `card_update` SSE event; send `{ success: true }` result; session continues |
| `completed` | Store summary + `criteria_results` in AgentRun; broadcast; move card to `input.next_column` if set; mark AgentRun completed; session ends |
| `blocked` | Store `blocked_reason` in `AgentRun.blockedReason`; set status=blocked; broadcast `card_blocked` SSE event with CLI attach command (see §13); send `{ success: true }` result; session stays live, awaiting human input |

If `status=completed` but any `criteria_results[].passed == false`, the agent runner should **not** mark the run completed. Instead respond with `{ success: false, reason: "Criterion failed: <criterion>" }` so the agent can attempt to fix it.

### 6.6 Prompt Rendering

The initial prompt sent to the agent is rendered from two parts:
1. The **role system prompt** (from `workflows/<role>.md`) — set on the agent at creation time
2. The **turn prompt** — constructed per card and sent as `user.message`

**Turn prompt template:**
```
You are working on a Kanban task assigned to you as {{ role_display_name }}.

## Task

**Title:** {{ card.title }}
{% if card.description %}
**Description:**
{{ card.description }}
{% endif %}
{% if card.githubRepoUrl %}
**Repository:** {{ card.githubRepoUrl }} (mounted at /workspace/repo, branch: {{ card.githubBranch | default: "main" }})
{% endif %}

{% if card.acceptanceCriteria %}
## Acceptance Criteria

You MUST verify every criterion below before calling `update_card(completed)`.
For each criterion, collect concrete evidence (command output, test results, URLs).
If any criterion cannot be met, call `update_card(blocked)` and explain why.

{{ card.acceptanceCriteria }}
{% endif %}

{% if run.attempt > 1 %}
## Retry Context

This is attempt #{{ run.attempt }}. Previous attempts failed. Resume from the current state.
{% endif %}

## Instructions

Complete the task described above. Use the available tools to accomplish your work.
When you are done, call `update_card(completed)` with your summary, criteria_results for
every acceptance criterion, and the column to move this card to.
Call `update_card(in_progress)` periodically to report progress on long tasks.
Call `update_card(blocked)` only if you genuinely cannot proceed without human input.
Do not ask for human input in your messages — if stuck, use update_card(blocked).
```

### 6.7 Max Turns

If the agent completes a turn (session goes `idle`) but has not yet called `update_card` with `status=completed`, the agent runner may send a continuation message (up to `MAX_TURNS`, default: 10). If `MAX_TURNS` is reached without completion, treat as failure and schedule retry.

---

## 7. Role Workflows

Three built-in roles ship with the reference implementation. Additional roles can be added by creating a new `workflows/<role>.md` file and registering the role in the workflow registry.

### 7.1 Built-in Roles

| Role Key | Display Name | Focus |
|---|---|---|
| `backend_engineer` | Backend Engineer | Implementation: code, APIs, databases, tests |
| `qa` | QA Engineer | Testing: test plans, edge cases, regression, automation |
| `tech_lead` | Tech Lead | Architecture: design decisions, code review, trade-offs |

### 7.2 Agent Configuration per Role

Each role maps to one Anthropic agent. All roles share:
- **Model:** `claude-opus-4-6`
- **Tools:** `agent_toolset_20260401` (full toolset enabled) + `update_card` custom tool

Role-specific system prompts are loaded from `workflows/<role>.md` at setup time and stored on the Anthropic agent object. System prompts should define:
- The role's persona and responsibilities
- How to approach the task type
- When to call `update_card`
- Constraints (e.g. always write tests, always document decisions)

### 7.3 Shared Environment Configuration

All roles share one Anthropic environment:
```json
{
  "name": "kobani-env",
  "config": {
    "type": "cloud",
    "networking": { "type": "unrestricted" }
  }
}
```

---

## 8. Real-Time Updates

The board UI receives live agent output via Server-Sent Events.

### 8.1 SSE Endpoint

`GET /api/cards/[id]/events`

Returns an SSE stream. The connection stays open for the duration of an active AgentRun. The server sends events as the agent runner processes them.

### 8.2 SSE Event Types (sent to UI)

| Type | Payload | Description |
|---|---|---|
| `agent_message` | `{ text: string }` | Streaming agent text output |
| `agent_thinking` | `{ thinking: string }` | Agent's extended thinking (collapsible) |
| `tool_use` | `{ tool_name: string, input: object }` | Agent used a built-in tool |
| `card_update` | `{ status, summary, next_column?, criteria_results? }` | Agent called update_card |
| `card_blocked` | `{ reason: string, session_id: string, cli_command: string }` | Agent is blocked; includes the `ant` CLI command to attach (see §13) |
| `status_change` | `{ status: AgentRunStatus }` | AgentRun status changed |
| `error` | `{ message: string }` | Session error |
| `done` | `{}` | Stream is closing (run terminal) |

### 8.3 Broadcaster

The agent runner writes events to an in-process pub-sub keyed by `cardId`. The SSE endpoint subscribes when a client connects and unsubscribes on disconnect. No external message broker is required for the reference implementation.

---

## 9. Setup vs. Runtime

Conforming implementations MUST separate one-time setup from per-card runtime dispatch.

### 9.1 One-Time Setup Script

A setup script (`scripts/setup-agents.ts` in the reference implementation) performs:

1. For each role in the workflow registry:
   a. Check if `AgentConfig` already exists for this role (idempotent)
   b. If not: call `agents.create(role_config)` → store `anthropicAgentId` + `anthropicAgentVersion`
2. Check if a shared `AgentConfig` environment entry exists
3. If not: call `environments.create(env_config)` → store `anthropicEnvironmentId`

The setup script writes results to the `AgentConfig` table. **It must not be called by the orchestrator or agent runner.**

### 9.2 Runtime Invariant

The orchestrator reads `AgentConfig` at startup. If any role's config is missing, the orchestrator logs an error and refuses to dispatch cards for that role. The application remains functional for other roles.

---

## 10. Safety Invariants

These invariants MUST hold in all conforming implementations.

1. **No double-dispatch.** A card may not have two AgentRuns in `running` or `idle` state simultaneously. The `claimed` set in the orchestrator enforces this.

2. **No hot-path agent creation.** `agents.create()` and `environments.create()` are setup operations only. The orchestrator dispatch path reads from `AgentConfig` and calls `sessions.create()` only.

3. **Session cleanup on column move.** When a card moves to a terminal column, any active Anthropic session for that card MUST be interrupted (send `user.interrupt`) and the AgentRun status set to `cancelled`. Orphaned sessions waste Anthropic infrastructure.

4. **Concurrency cap enforced before session creation.** The orchestrator checks `len(running) < MAX_CONCURRENT` before creating any new session. Session creation itself is not the guard — the dispatch decision is.

5. **Stream-first ordering.** The SSE stream to Anthropic MUST be opened before or concurrently with the `sessions.events.send()` call for the initial message. See §6.3.

6. **Retry ceiling.** After `MAX_ATTEMPTS` failed attempts, a card is permanently in `failed` state. The orchestrator will not dispatch a new AgentRun. A human operator must intervene.

7. **Output immutability.** `AgentRun.output` is append-only during a session. Previous output is never deleted or overwritten; only new content is appended.

---

## 11. Configuration Reference

All configuration is via environment variables.

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | required | Anthropic API key |
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `GITHUB_TOKEN` | optional | PAT for GitHub repo mounting (Contents: read+write) |
| `POLL_INTERVAL_MS` | `3000` | Orchestrator poll cadence (ms) |
| `MAX_CONCURRENT_AGENTS` | `5` | Global concurrency cap |
| `MAX_ATTEMPTS` | `5` | Max retry attempts per card |
| `MAX_RETRY_BACKOFF_MS` | `300000` | Max retry delay (5 minutes) |
| `MAX_TURNS` | `10` | Max agent turns per session before treating as failure |
| `MAX_STALL_MS` | `3600000` | Max run time before stall detection (1 hour) |

---

## 12. Verification Scenarios

A conforming implementation passes all of the following end-to-end scenarios.

### 12.1 Happy Path
1. Create a board with columns: Backlog (inactive), In Progress (active), Review (active), Done (terminal)
2. Create a card with title "Write unit tests for auth module", role=qa, description with details
3. Drag card to "In Progress"
4. **Expected:** AgentRun created (pending), session created (running), SSE stream opens on card, agent output appears in real time, agent calls `update_card(completed, summary, next_column="Done")`, card moves to "Done", AgentRun status=completed

### 12.2 Retry on Failure
1. Create a card in "In Progress"
2. Simulate a session failure (e.g. by revoking the session or using an invalid repo URL)
3. **Expected:** AgentRun status=failed, retry scheduled after backoff delay, second AgentRun created with attempt=2, session retried

### 12.3 Concurrency Cap
1. Set MAX_CONCURRENT_AGENTS=2
2. Create 5 cards in "In Progress" simultaneously
3. **Expected:** Exactly 2 AgentRuns in `running` state; 3 cards remain `pending` until a slot opens; as runs complete, pending cards are dispatched one at a time

### 12.4 Cancel on Column Move
1. Card is actively running (agent streaming output)
2. User drags card back to "Backlog"
3. **Expected:** `user.interrupt` sent to session, AgentRun status=cancelled, SSE stream closes, no further output appears on card

### 12.5 GitHub Repo Mounting
1. Create a card with `githubRepoUrl` set to a valid repo, `githubBranch=main`
2. Dispatch to "In Progress"
3. **Expected:** Session created with `resources=[{type:"github_repository",...}]`, agent can read and modify files at `/workspace/repo`

### 12.6 Setup Idempotency
1. Run the setup script twice
2. **Expected:** No duplicate agents or environments created; second run detects existing `AgentConfig` entries and skips creation

### 12.7 Startup Recovery
1. Start the application with cards in "In Progress" that have AgentRuns in `running` state from a previous process
2. **Expected:** Orchestrator attempts to reattach to existing sessions; sessions terminated during downtime are marked failed and retried

### 12.8 Acceptance Criteria — All Pass
1. Create a card with acceptance criteria:
   ```
   - All existing tests pass
   - New endpoint returns 200 with correct JSON schema
   ```
2. Dispatch to "In Progress"
3. **Expected:** Turn prompt includes criteria block; agent verifies both before calling `update_card(completed, criteria_results=[{passed:true,...},{passed:true,...}])`; card moves to "Done"

### 12.9 Acceptance Criteria — Partial Failure
1. Same setup as 12.8, but agent can only satisfy the first criterion
2. **Expected:** Agent runner rejects the `update_card(completed)` call with `{ success: false, reason: "Criterion failed: New endpoint returns 200..." }`; agent attempts to fix the failing criterion before retrying

### 12.10 Developer Terminal Attach (Blocked Card)
1. Create a card the agent will be unable to complete autonomously (e.g. "Deploy to prod — credentials are in 1Password")
2. Dispatch to "In Progress"
3. **Expected:** Agent calls `update_card(blocked, blocked_reason="Need production credentials")`; card shows blocked badge; `card_blocked` SSE event fires with `cli_command`; developer copies command, runs it in terminal, sends the credentials as a message; agent resumes; session events continue streaming to card UI

---

## 13. Developer Terminal Access

When a session is `blocked` or a developer wants to inspect a live session, the system provides a one-click path to attach to it via the Anthropic CLI (`ant`).

### 13.1 Motivation

The Managed Agents platform runs the container on Anthropic's infrastructure — there is no SSH or port forwarding. The `ant` CLI is the official first-party tool for interacting with sessions from a terminal. It connects to a running or idle session by ID and provides an interactive REPL over the same SSE event channel used by the board.

Any team member with the CLI installed and the API key configured can attach. This covers:
- **Developer:** inspects what the agent did, provides missing context, unblocks the session
- **PM:** reads the agent's progress without navigating the board UI
- **On-call engineer:** diagnoses a stuck or failed session

### 13.2 The Attach Command

When a session is `running` or `idle`/`blocked`, the card UI displays:

```
ant sessions connect <session_id>
```

> **Note:** Verify the exact subcommand against the Anthropic CLI documentation (`ant --help` or the URL in the Managed Agents docs). The canonical URL is in `shared/live-sources.md` under "Anthropic CLI". The command above is indicative; `ant beta sessions connect` or `ant sessions attach` may be the actual form.

The command is:
- Shown prominently on the card when status is `blocked`
- Available via a "copy" button on any card with an active `sessionId`
- Included in the `card_blocked` SSE event payload as `cli_command`

### 13.3 What Happens When You Attach

Attaching via the CLI connects to the live session. From that point:

- You see the agent's full message history
- You can send messages directly (`user.message` events) — the agent receives them and resumes
- Any tool calls and responses are visible in real time
- The board UI continues to receive SSE events from the same session — the card updates as the agent works
- When the agent calls `update_card(completed)` or the session terminates, the card transitions normally

The CLI session and the board UI are both consumers of the same Anthropic SSE stream. They are not in conflict.

### 13.4 Card UI Requirements

The card component MUST:

1. Display the `sessionId` (truncated, e.g. `sess_abc…xyz`) for any AgentRun with status `running`, `idle`, or `blocked`
2. Provide a "Copy attach command" button that writes `ant sessions connect <session_id>` to the clipboard
3. When status=`blocked`: surface a prominent "Blocked" badge, show `AgentRun.blockedReason`, and make the attach command the primary CTA
4. When status=`running` or `idle`: show the attach command in a collapsible "Debug" panel

### 13.5 Human Message from the UI (Optional Enhancement)

As an alternative to the CLI, the card UI MAY provide a text input to send a `user.message` directly to a `blocked` or `idle` session via `POST /api/cards/[id]/message`. This is a convenience wrapper — it calls `sessions.events.send()` and relies on the existing SSE stream to reflect the response. It does not replace the CLI; it is a lower-friction option for simple unblocking messages.

`POST /api/cards/[id]/message`
```json
{ "text": "The production DB credentials are in ANTHROPIC_DB_URL env var" }
```

The endpoint:
1. Looks up the card's active AgentRun and its `sessionId`
2. Validates session status is `blocked` or `idle`
3. Calls `sessions.events.send(sessionId, { type: "user.message", content: [{ type: "text", text }] })`
4. Sets AgentRun status back to `running`

---

## Appendix A: Symphony Mapping Reference

For implementors familiar with Symphony's codebase, this table maps Symphony concepts to their equivalents in this spec.

| Symphony Concept | This Spec Equivalent |
|---|---|
| `SymphonyElixir.Orchestrator` GenServer | §5 Orchestrator |
| `SymphonyElixir.AgentRunner.run/3` | §6 Agent Runner |
| `SymphonyElixir.Codex.AppServer` | Anthropic `client.beta.sessions.*` |
| `SymphonyElixir.Linear.Client` | Database queries on Card/Column tables |
| `SymphonyElixir.WorkflowStore` | `workflows/` directory + `AgentConfig` table |
| `WORKFLOW.md` YAML front matter | Environment variables + `AgentConfig` table |
| `WORKFLOW.md` Markdown body | `workflows/<role>.md` system prompt files |
| `codex.command` | `anthropicAgentId` + `sessions.create()` |
| `workspace.root` + per-issue directory | Anthropic-hosted container per session |
| `hooks.after_create` (git clone) | `sessions.create({ resources: [github_repository] })` |
| `app-server` JSON-RPC `turnStart` | `sessions.events.send({ type: "user.message" })` |
| `turn/completed` event | `session.status_idle` with `stop_reason.type=end_turn` |
| `content/request` event | `agent.message` event |
| `tool/request` event | `agent.custom_tool_use` event |
| `codex_update_recipient` PubSub | SSE broadcaster keyed by `cardId` |
| Phoenix LiveView dashboard | Kanban board with real-time SSE |
| `issue.state` Linear field | `card.columnId` → `column.isActiveState` |
| `max_concurrent_agents` | `MAX_CONCURRENT_AGENTS` env var |
| `max_turns` | `MAX_TURNS` env var |
| `max_retry_backoff_ms` | `MAX_RETRY_BACKOFF_MS` env var |
