# TAKE/MY/JOB

A Kanban board that spawns Claude managed agents with different roles to fulfill tasks in a prod-tech organization.

Built for a hackathon using the [Anthropic Managed Agents API](https://platform.claude.com/docs/en/managed-agents/overview).

---

## Prerequisites

Install [mise](https://mise.jdx.dev) — a polyglot tool version manager for macOS:

```bash
brew install mise
```

Then add mise to your shell (add to `~/.zshrc`):

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
# Add your Anthropic API key to .env.local

# 5. Set up the database
npx prisma migrate dev

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com)) |
| `DATABASE_URL` | SQLite DB path (default: `file:./dev.db`) |

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma |
| AI | Anthropic SDK — Managed Agents |
| Language | TypeScript |

---

## How it works

Each Kanban card represents a task. When a card is moved to a column (e.g. "In Progress"), the board spawns a Claude managed agent assigned a specific role (e.g. Backend Engineer, QA, Tech Lead) to work on that task. Agents collaborate asynchronously and update the card with their output.
