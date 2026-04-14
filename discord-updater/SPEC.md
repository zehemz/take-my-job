# Discord Notification Spec — Live Session Digests

## Goal

A standalone Discord bot (`discord-updater/`) that posts a live-updating Discord message for every Claude Code session across all projects. When work starts, a card appears. As turns complete, the card is edited in-place. When the session ends, the card is marked done.

Designed for a future monorepo where multiple projects (take-my-job, Kobani tasks, etc.) each configure the same hook and the bot handles them all, identified by `cwd`.

---

## Architecture

```
Claude Code session
  │
  ├─ SessionStart  ──http POST──▶ discord-updater :3001/hook
  ├─ Stop          ──http POST──▶   → routes by hook_event_name
  ├─ StopFailure   ──http POST──▶   → reads git context from cwd
  └─ SessionEnd    ──http POST──▶   → creates / edits Discord message
                                          │
                                    Discord API (bot token)
                                    PATCH /channels/:id/messages/:id
```

**Key design decisions:**
- Claude Code `http` hooks POST raw event JSON to the bot — no shell scripts
- The bot edits a **single message per session** rather than posting new ones (live card, not spam)
- `http` hooks return 200 immediately; bot handles Discord API calls asynchronously
- Multi-project: `cwd` in the payload identifies which project fired the event

---

## File Layout

```
discord-updater/
  src/
    server.ts           ← Express HTTP server, POST /hook router
    discord.ts          ← Discord REST API (createMessage, editMessage)
    session-store.ts    ← In-memory Map: session_id → { messageId, cwd, turns, ... }
    event-handlers.ts   ← onSessionStart, onStop, onStopFailure, onSessionEnd
    git-context.ts      ← Runs git -C <cwd> commands to gather context
    embeds.ts           ← Builds Discord embed objects per event type
  package.json
  tsconfig.json
  .env.example
```

---

## Discord Message Lifecycle

| Event | Action | Embed color |
|---|---|---|
| `SessionStart` | `createMessage` → save `messageId` | Blue — active |
| `Stop` (each turn) | `editMessage` with updated diff/status | Green — working |
| `StopFailure` | `editMessage` with failure info | Red — deviation |
| `SessionEnd` | `editMessage` with final summary + duration | Grey — done |

---

## Setup

### 1. Create the Discord bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. New Application → Bot → **Reset Token** → copy token
3. OAuth2 → URL Generator → scopes: `bot` → permissions: `Send Messages`, `Read Message History`
4. Invite bot to your server via the generated URL
5. Enable **Developer Mode** in Discord settings → right-click target channel → **Copy Channel ID**

### 2. Configure environment

```bash
cd discord-updater
cp .env.example .env
# Fill in DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID
```

### 3. Install and run

```bash
cd discord-updater
npm install
npm run dev        # watches for changes
# or
npm start          # production
```

### 4. Hooks are already configured

`.claude/settings.local.json` already has `SessionStart`, `Stop`, `StopFailure`, and `SessionEnd` hooks pointing at `http://localhost:3001/hook`. The bot just needs to be running.

### 5. Smoke test

```bash
curl -X POST http://localhost:3001/hook \
  -H "Content-Type: application/json" \
  -d '{"hook_event_name":"SessionStart","session_id":"test-123","cwd":"/Users/lbais/Development/take-my-job"}'
```

Check Discord for the new message card.

---

## Multi-project Setup (monorepo / Kobani tasks)

Each project that wants Discord notifications adds the same hooks to its `.claude/settings.local.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "http", "url": "http://localhost:3001/hook", "timeout": 5 }] }],
    "Stop":         [{ "hooks": [{ "type": "http", "url": "http://localhost:3001/hook", "timeout": 5 }] }],
    "StopFailure":  [{ "hooks": [{ "type": "http", "url": "http://localhost:3001/hook", "timeout": 5 }] }],
    "SessionEnd":   [{ "hooks": [{ "type": "http", "url": "http://localhost:3001/hook", "timeout": 5 }] }]
  }
}
```

The bot identifies each project by `cwd` (last path segment becomes the project name in the Discord card). One bot instance handles all projects simultaneously.

---

## Future extensions

- **Threads per project** — instead of a flat channel, create a thread per project and post updates there
- **Mention on failure** — add `<@USER_ID>` to `StopFailure` content to ping on deviations
- **Transcript summary** — on `SessionEnd`, read `.claude/transcripts/` and include a plain-English summary of what was done
- **SubagentStop granularity** — add hook for subagent completions if per-agent visibility is needed
- **Persistent store** — swap in-memory Map for SQLite so message IDs survive bot restarts
