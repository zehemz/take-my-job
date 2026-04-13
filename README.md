# Kobani

A Kanban board that dispatches Claude managed agents to fulfill tasks in a prod-tech organization. Column transitions — not manual prompts — drive agent dispatch. Teams manage work instead of supervising agents.

Inspired by [Symphony](https://github.com/openai/symphony), substituting Anthropic Managed Agents for OpenAI Codex and Kanban columns for Linear issues.

---

## Prerequisites

Install [mise](https://mise.jdx.dev) — a polyglot tool version manager:

```bash
brew install mise
```

Then activate mise in your shell (add to `~/.zshrc`):

```bash
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc
source ~/.zshrc
```

---

## Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd take-my-job

# 2. Trust the mise config and install tools (Node.js 22)
mise trust
mise install

# 3. Install dependencies
npm install

# 4. Set up environment variables
cp .env.example .env.local
# Add your Anthropic API key and Neon DATABASE_URL to .env.local

# 5. Set up the database (requires a running PostgreSQL — e.g. Neon free tier)
npx prisma migrate dev

# 6. Run one-time agent setup (creates Anthropic agents + environment)
npx tsx scripts/setup-agents.ts

# 7. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | required | Anthropic API key ([console.anthropic.com](https://console.anthropic.com)) |
| `DATABASE_URL` | required | PostgreSQL connection string (e.g. Neon) |
| `GITHUB_TOKEN` | optional | GitHub PAT for repo mounting (Contents: read+write) |
| `POLL_INTERVAL_MS` | `3000` | Orchestrator poll cadence (ms) |
| `MAX_CONCURRENT_AGENTS` | `5` | Global concurrency cap |
| `MAX_ATTEMPTS` | `5` | Max retry attempts per card |
| `MAX_RETRY_BACKOFF_MS` | `300000` | Max retry delay (5 min) |
| `MAX_TURNS` | `10` | Max agent turns per session |
| `MAX_STALL_MS` | `3600000` | Stall detection threshold (1 hour) |
| `CLI_ATTACH_COMMAND_TEMPLATE` | `ant sessions connect {session_id}` | Template for the CLI attach command |

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Database | PostgreSQL (Neon) via Prisma |
| AI | Anthropic Managed Agents API |
| Language | TypeScript |

---

## Architecture

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
│   Poll loop · dispatch pending · reconcile running       │
│   Concurrency cap · exponential backoff retries          │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                      Agent Runner                        │
│   Creates session per card+role · SSE stream-first       │
│   Handles agent output + custom tool calls               │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────┐
│              Anthropic Managed Agents Platform           │
└─────────────────────────────────────────────────────────┘
```

---

## How It Works

Each Kanban card represents a unit of work. Columns are typed:

- **Inactive** (e.g. "Backlog") — no agent action
- **Active** (e.g. "In Progress", "Review") — dispatches an agent on entry
- **Terminal** (e.g. "Done", "Cancelled") — cleans up sessions on entry

When a card enters an active column, the orchestrator assigns a Claude managed agent with a specific role to work on it. Agents operate autonomously, stream output back to the card in real time via SSE, and transition the card to its next column when work is complete.

### Built-in Roles

| Role | Focus |
|---|---|
| Backend Engineer | Implementation: code, APIs, databases, tests |
| QA Engineer | Testing: test plans, edge cases, regression, automation |
| Tech Lead | Architecture: design decisions, code review, trade-offs |

### Key Features

- **Acceptance criteria** — cards can include criteria the agent must verify before completing
- **Blocked state** — agents can signal when they need human input; developers attach via the `ant` CLI or send messages through the card UI
- **Retry with backoff** — failed runs are retried with exponential backoff (up to `MAX_ATTEMPTS`)
- **GitHub repo mounting** — cards can reference a repo; the agent session mounts it at `/workspace/repo`
- **Concurrency control** — the orchestrator enforces a global cap on simultaneous agent runs

---

## Developer Terminal Access

When an agent is blocked or you want to inspect a live session, copy the attach command from the card UI:

```bash
ant sessions connect <session_id>
```

This connects to the live Anthropic session, showing full message history and letting you send messages to unblock the agent. The board UI continues receiving updates from the same session.
