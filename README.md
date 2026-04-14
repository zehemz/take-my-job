<div align="center">

# Kobani

**A Kanban board that dispatches AI agents to do the work, not just track it.**

Column transitions drive autonomous Claude agent dispatch — teams manage work, not agents.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=next.js)](https://nextjs.org/)
[![Anthropic](https://img.shields.io/badge/Anthropic-Managed%20Agents-D4A574?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/zehemz/take-my-job/pulls)

</div>

---

## What is Kobani?

Kobani turns your Kanban board into an AI-powered execution engine. Instead of manually prompting AI assistants, you move cards between columns — and Claude agents pick up the work automatically.

- **Drag a card to "In Progress"** → a Backend Engineer agent starts coding
- **Move it to "Review"** → a Tech Lead agent reviews the work
- **Agent gets stuck?** → it moves to "Blocked" and you can chat with it in real time

Inspired by [OpenAI Symphony](https://github.com/openai/symphony), substituting Anthropic Managed Agents for OpenAI Codex and Kanban columns for Linear issues.

## Features

### Core Kanban + AI
- **Autonomous agent dispatch** — column transitions trigger agent sessions, no manual prompting needed
- **Multiple agent roles** — Backend Engineer, QA Engineer, Tech Lead, and custom roles with distinct responsibilities
- **Real-time streaming** — live SSE output from agents directly in the card UI
- **Drag-and-drop Kanban** — intuitive board with customizable columns (Inactive, Active, Review, Blocked, Terminal)
- **Acceptance criteria** — define what "done" looks like; agents verify before completing
- **Card dependencies** — cards can depend on other cards; won't auto-promote until dependencies complete
- **Blocked state & human-in-the-loop** — agents signal when they need help; reply through the UI or attach via CLI
- **Approval workflow** — require human approval before agents can transition cards
- **Retry with exponential backoff** — failed runs auto-retry up to configurable limits

### Agent & Environment Management
- **Agent inline editing** — edit name, model, system prompt, tools, and MCP servers from the detail page with version conflict detection
- **Environment management** — create (with presets), edit networking/packages, and delete Anthropic environments
- **Per-card environment override** — cards can use a specific environment instead of the board default
- **GitHub repo mounting** — agents get the repo at `/workspace/repo` for full code access
- **Session inspection** — view active agent sessions and attach via the `ant` CLI

### Access Control & Collaboration
- **Role-based access control (RBAC)** — database-backed users and groups with per-agent-role and per-environment permissions
- **Admin UI** — manage users, groups, and access policies at `/access`
- **GitHub OAuth authentication** — secure access with invite-only authorization
- **Attention queue & notifications** — surface cards that need human attention with real-time alerts
- **Board completion indicator** — dashboard shows completed vs total cards per board
- **Multiple boards** — create and manage separate boards for different projects or teams
- **Concurrency control** — global cap on simultaneous agent runs

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Kanban Board UI                     │
│  Drag-and-drop columns → card moves → API routes      │
│  Real-time agent output ← SSE stream per card         │
└───────────────────────┬──────────────────────────────┘
                        │ HTTP
┌───────────────────────▼──────────────────────────────┐
│                      API Layer                        │
│  /api/cards/[id]/move  — triggers orchestrator        │
│  /api/cards/[id]/events — SSE stream for UI           │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                    Orchestrator                        │
│  Poll loop · dispatch pending · reconcile running     │
│  Concurrency cap · exponential backoff retries        │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                   Agent Runner                        │
│  Creates session per card+role · SSE stream-first     │
│  Handles agent output + custom tool calls             │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼──────────────────────────────┐
│           Anthropic Managed Agents Platform            │
└──────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | [TypeScript 5.8](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Database | [PostgreSQL](https://www.postgresql.org/) (Neon) via [Prisma](https://www.prisma.io/) |
| AI | [Anthropic Managed Agents API](https://www.anthropic.com/) |
| Auth | [NextAuth.js](https://next-auth.js.org/) (GitHub OAuth) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Drag & Drop | [dnd-kit](https://dndkit.com/) |
| Testing | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |
| Tooling | [mise](https://mise.jdx.dev/) (runtime & task management) |

## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev) — polyglot tool version manager
- A PostgreSQL database (e.g. [Neon](https://neon.tech/) free tier)
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
# Clone the repo
git clone https://github.com/zehemz/take-my-job.git
cd take-my-job

# Trust the mise config and install tools (Node.js 22)
mise trust && mise install

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Anthropic API key and DATABASE_URL

# Run database migrations
npx prisma migrate dev

# Create Anthropic agents + environment (one-time setup)
npx tsx scripts/setup-agents.ts

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GITHUB_TOKEN` | No | GitHub PAT for repo mounting (Contents: read+write) |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth app client secret |
| `AUTH_SECRET` | No | Session secret — generate with `openssl rand -hex 32` |
| `ALLOWED_GITHUB_USERS` | No | Comma-separated GitHub usernames allowed access |
| `DEV_AUTH_BYPASS` | No | Set to `true` to skip OAuth in development |
| `POLL_INTERVAL_MS` | No | Orchestrator poll cadence (default: `3000`) |
| `MAX_CONCURRENT_AGENTS` | No | Global concurrency cap (default: `5`) |
| `MAX_ATTEMPTS` | No | Max retry attempts per card (default: `5`) |
| `MAX_TURNS` | No | Max agent turns per session (default: `10`) |

See [`.env.example`](.env.example) for the full list with defaults.

## Usage

### Common Tasks (via mise)

```bash
mise run dev          # Start dev server
mise run e2e          # Run Playwright E2E tests
mise run e2e:ui       # Run E2E tests interactively
mise run db           # Open Prisma Studio
mise run db:migrate   # Run pending migrations
```

### Attaching to a Live Agent Session

When an agent is blocked or you want to inspect its work:

```bash
ant sessions connect <session_id>
```

Copy the session ID from the card UI. This gives you full message history and lets you send messages to unblock the agent.

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Run tests (`npm test && npm run e2e`)
5. Commit your changes
6. Push to your branch and open a Pull Request

Please make sure your PR:
- Includes tests for new functionality
- Follows the existing code style
- Updates documentation if needed

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with [Anthropic Managed Agents](https://www.anthropic.com/) and [Next.js](https://nextjs.org/)

</div>
