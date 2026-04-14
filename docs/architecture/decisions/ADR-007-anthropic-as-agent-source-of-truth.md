# ADR-007 — Anthropic as Source of Truth for Agent Data

**Status:** Accepted

---

## Context

The original Agent Management design stored all agent data (model, name, version, tools, system prompt, environment ID) in the local `AgentConfig` DB table, populated exclusively by `scripts/setup-agents.ts`. The `/agents` UI page read directly from the DB.

This created a correctness problem: the DB reflects what was provisioned at setup time, not the current state of the agent in Anthropic's platform. If an agent's model, system prompt, or tool list is updated on Anthropic's side — or if an agent is deleted — the local DB record becomes stale. Operators viewing the page would see outdated data without any indication that it no longer matched reality.

---

## Decision

**Anthropic's Managed Agents API is the source of truth for agent data.** On every request to `GET /api/agents`, the route calls `lib/agents-service.ts` `listAgents()`, which:

1. Fetches the live agent list from the Anthropic API.
2. Reads all `AgentConfig` rows from the local DB.
3. Joins the two sets by `anthropicAgentId`, producing a merged `AgentRow[]` response.

The local `AgentConfig` table's sole responsibility is to store the mapping from Anthropic agent ID to application role. It owns no other agent data.

The response shape (`AgentRow`) carries the sync state of each agent:

- **`healthy`** — the Anthropic agent exists and has a matching DB role mapping.
- **`unmapped`** — the Anthropic agent exists but has no corresponding DB record (no role assigned).
- **`orphaned`** — a DB record exists but the Anthropic API returned no matching agent (agent was deleted or ID changed).

---

## Consequences

- The `/agents` page always reflects the current state of agents in Anthropic's platform.
- DB drift is made visible: orphaned and unmapped states surface in the UI rather than being silently hidden.
- Every page load incurs one Anthropic API call. If the Anthropic API is unreachable, `GET /api/agents` returns `502 Bad Gateway` rather than serving stale DB data.
- `ANTHROPIC_API_KEY` must be valid and present at runtime. A missing or invalid key makes the agents page non-functional.
- The `AgentConfig` DB table schema can be simplified over time — fields that duplicate Anthropic-owned data (model, version, tools, system prompt) can be dropped.

---

## Rejected Alternatives

### Periodic sync job

A background job could poll the Anthropic API on a schedule and write results into the DB, keeping the page fast and DB-sourced. Rejected because sync jobs introduce lag (the page can still be stale between runs), add operational complexity (job scheduling, failure handling, monitoring), and obscure the source of truth — operators would not know whether they're seeing live or cached data.

### Full DB as source of truth (original design)

Keep the DB as the primary store and treat setup-time provisioning as canonical. Rejected because it gives operators a false sense of accuracy. Any change made outside the local DB (Anthropic dashboard, API, another deployment) is invisible. This was the triggering problem.
