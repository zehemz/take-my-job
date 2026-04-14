# Kobani — Glossary

Domain terms used across specs, code, and conversations. If a term appears in
`lib/kanban-types.ts`, `lib/types.ts`, or the API contract, it is defined here.

---

## Entities

**Board** — top-level container. Has a name, owns columns and cards. Optionally linked to a **workspace repo** via `githubRepo` (repo URL) and `workspacePath` (subfolder within the repo).

**Column** — a swimlane on the board. Has a `ColumnType` that determines how the orchestrator treats cards inside it.

**Card** — a unit of work. Has a title, description, acceptance criteria, assigned role, and optional GitHub repo/branch (auto-inherited from the board's workspace repo if configured). Moves between columns as agents complete work.

**Workspace Repo** — a shared GitHub repository (`WORKSPACE_REPO_URL`) where each board gets its own subfolder. Agents mount this repo and work inside their board's folder, pushing directly to `main`. Folders are provisioned via the GitHub Contents API at board creation time (`lib/workspace.ts`).

**AgentRun** — a single execution of an AI agent against a card. A card can have multiple runs (retries, re-triggers). The most recent run determines the card's `agentStatus`.

**AgentConfig** — per-role configuration: Anthropic agent ID, version, and environment ID. Created once via `scripts/setup-agents.ts`.

---

## Column Types (`ColumnType`)

Defined in `lib/kanban-types.ts`. Determines orchestrator behaviour.

| Value | `isActiveState` | `isTerminalState` | Behaviour |
|-------|----------------|-------------------|-----------|
| `inactive` | false | false | Cards wait here; no agent is dispatched |
| `active` | true | false | Orchestrator picks up cards and dispatches agents |
| `review` | true | false | Agent is running in review/QA mode |
| `revision` | true | false | Card sent back for revision; agent re-runs |
| `terminal` | false | true | Work done; no further agent dispatch |

---

## Agent Status (`AgentStatus`)

Frontend-facing status derived from the latest `AgentRun`. Defined in `lib/kanban-types.ts`.

| Value | Meaning |
|-------|---------|
| `idle` | No active run, or run is pending/queued |
| `running` | Agent is actively executing |
| `evaluating` | Agent is checking acceptance criteria (transient, via SSE) |
| `evaluation-failed` | Run completed but one or more criteria did not pass |
| `blocked` | Agent called `update_card(blocked)` — needs human input |
| `pending-approval` | Awaiting human sign-off before moving to next column |
| `failed` | Run errored or was cancelled after max retries |
| `completed` | All criteria passed; card moved to next column |

---

## DB Agent Run Status (`AgentRunStatus`)

Prisma enum stored in the database. Mapped to `AgentStatus` by `lib/api-mappers.ts`.

| DB value | Maps to frontend `AgentStatus` |
|----------|-------------------------------|
| `pending` | `idle` |
| `running` | `running` |
| `idle` | `idle` |
| `blocked` | `blocked` |
| `completed` | `completed` or `evaluation-failed` (depends on `criteriaResults`) |
| `failed` | `failed` |
| `cancelled` | `idle` |

---

## Agent Roles (`AgentRole`)

| Value | Description |
|-------|-------------|
| `backend-engineer` | Implements features, writes tests, opens PRs |
| `qa-engineer` | Writes and runs test suites, checks edge cases |
| `tech-lead` | Reviews architecture, code quality, trade-offs |
| `content-writer` | Produces written content, docs, copy |
| `product-spec-writer` | Writes PRDs, user stories, acceptance criteria |
| `designer` | Produces design specs, component descriptions, UX flows |

---

## Acceptance Criteria

Stored as a JSON array in `Card.acceptanceCriteria` (DB field). Each item:

```ts
{ id: string; text: string; passed: boolean | null; evidence: string | null }
```

`passed: null` means not yet evaluated. After an agent run, each criterion is
marked `true`/`false` with `evidence` explaining the result.

---

## Broadcaster

In-process pub/sub keyed by `cardId`. The orchestrator emits events; the SSE
route subscribes and forwards them to the browser. Singleton at
`lib/broadcaster-singleton.ts`.

---

## Whitelist

Comma-separated GitHub usernames in `ALLOWED_GITHUB_USERS` env var. Checked at
sign-in. Empty string or unset = startup failure (fail-closed). See
[ADR-002](../architecture/decisions/ADR-002-deploy-boundary-revocation.md).
