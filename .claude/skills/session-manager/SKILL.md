---
name: session-manager
description: >
  Manage Anthropic Managed Agent sessions using the `ant` CLI. Use this skill whenever the user wants to
  list, query, inspect, archive, or delete agent sessions — including questions like "what sessions are running",
  "clean up old sessions", "how many idle sessions do we have", "show me sessions for agent X",
  "what's that session doing", or "archive stale sessions". Also triggers for broader questions about
  session health, usage, or cost when the user is working with Managed Agents.
---

# Session Manager

You manage Anthropic Managed Agent sessions via the `ant` CLI. The `ant` binary is at `/opt/homebrew/bin/ant`.

## Core commands

All session commands live under `ant beta:sessions`. The API returns JSONL when you use `--format jsonl` (one JSON object per line, best for `jq` pipelines) or `--format json` (array, but can be very large).

### List sessions

```bash
ant beta:sessions list --format jsonl --max-items -1
```

Key filters:
- `--agent-id <id>` — filter by agent
- `--created-at-gt <ISO8601>` / `--created-at-lt <ISO8601>` — date range
- `--include-archived` — include archived sessions (excluded by default)
- `--limit <n>` — page size; `--max-items -1` for all

### Retrieve a single session

```bash
ant beta:sessions retrieve --session-id <id> --format json
```

### Archive a session

Archiving is soft-delete — the session data is preserved but hidden from default listings.

```bash
ant beta:sessions archive --session-id <id>
```

### Delete a session

Permanent. Ask the user to confirm before deleting.

```bash
ant beta:sessions delete --session-id <id>
```

### List session events (conversation turns)

```bash
ant beta:sessions:events list --session-id <id> --format jsonl --max-items -1
```

### List session resources (files, etc.)

```bash
ant beta:sessions:resources list --session-id <id> --format jsonl
```

## Session JSON shape

Each session object has these key fields:

```
.id                       — session ID (sesn_...)
.status                   — "running", "idle", or "terminated"
.agent.name               — agent name
.agent.id                 — agent ID (agent_...)
.title                    — human-readable title
.created_at               — ISO8601 creation time
.updated_at               — ISO8601 last update time
.archived_at              — null or ISO8601 archive time
.stats.active_seconds     — CPU time actually spent processing turns
.stats.duration_seconds   — wall-clock time since creation
.usage.input_tokens       — total input tokens consumed
.usage.output_tokens      — total output tokens consumed
.usage.cache_read_input_tokens
.usage.cache_creation.ephemeral_5m_input_tokens
.usage.cache_creation.ephemeral_1h_input_tokens
```

A session with `active_seconds == 0` was created but never processed a turn — it's dead weight.

## Common workflows

### Summary overview

When the user asks "what sessions do we have" or "show me session status", produce a concise table:

```bash
# Count by status
ant beta:sessions list --format jsonl --max-items -1 | jq -r '.status' | sort | uniq -c | sort -rn

# Running sessions (always show these)
ant beta:sessions list --format jsonl --max-items -1 | \
  jq -r 'select(.status == "running") | [.id, .agent.name, .title[:80], .created_at] | @tsv' | \
  column -t -s$'\t'
```

### Find stale/dead sessions

Sessions that are idle with zero activity are safe to archive:

```bash
ant beta:sessions list --format jsonl --max-items -1 | \
  jq -r 'select(.status == "idle" and .stats.active_seconds == 0) | .id' | wc -l
```

### Bulk archive

Use `xargs -P` for parallelism. Always tell the user how many will be affected and what the filter criteria are before proceeding.

```bash
ant beta:sessions list --format jsonl --max-items -1 | \
  jq -r 'select(.status == "idle" and .stats.active_seconds == 0) | .id' | \
  xargs -P 20 -I {} ant beta:sessions archive --session-id {} --format json 2>&1 | \
  jq -r '.status' | sort | uniq -c
```

### Bulk delete

Same pattern but with `ant beta:sessions delete`. Since deletion is permanent, always confirm with the user first and state exactly what will be deleted.

### Filter by agent

```bash
ant beta:sessions list --format jsonl --max-items -1 --agent-id agent_XXXXX | \
  jq -r '[.id, .status, .title[:60]] | @tsv' | column -t -s$'\t'
```

### Usage/cost analysis

```bash
ant beta:sessions list --format jsonl --max-items -1 | \
  jq -r 'select(.status != "terminated") | [.id, .agent.name, .usage.input_tokens, .usage.output_tokens, .stats.active_seconds] | @tsv' | \
  column -t -s$'\t'
```

## Guidelines

- Default to `--format jsonl` piped through `jq` for processing. Use `--format json` only for single-session retrieval.
- Always use `--max-items -1` when you need the full list — the default page size is small.
- For bulk operations, show the count and criteria to the user before executing.
- Archive before delete — archiving is reversible, deletion is not.
- When presenting results, prefer concise tables over raw JSON dumps.
- For large result sets, summarize with counts/aggregations first, then offer to show details.
