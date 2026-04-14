# PRD — Agent Management

## Problem

`AgentConfig` records are currently created exclusively via `scripts/setup-agents.ts` and have no
visibility in the application UI. Operators have no way to inspect which agents are configured, what
model/version they run, or retire stale configs — without querying the database directly. This
becomes a maintenance and debugging bottleneck as the agent roster grows.

## Goal

Provide a first-class **Agent Management** page where operators can view and manage the full set of
configured agents. The current scope covers **read-only listing** plus **delete**. Create / Update
operations are explicitly deferred and will be specced separately.

## Users

- **Operators / admins** — team members who manage the Kobani deployment and need visibility into
  which agents are live.

## Non-goals (v1)

- Creating new agent configurations from the UI.
- Editing agent system prompts or model settings from the UI.
- Agent session / run history (covered by the card detail view).
- Role-based access control beyond the existing whitelist.

## Success criteria

1. Any authenticated operator can navigate to `/agents` and see a list of all `AgentConfig` rows.
   (v1 access control is the existing whitelist — all whitelisted users are treated as operators.)
2. Each row displays: role, Anthropic agent ID, agent version, and creation date.
3. The list loads correctly when there are zero configs (empty state shown).
4. No sensitive secrets are exposed — agent IDs are display-only references, not credentials.
5. If the `GET /api/agents` request fails, the page shows an error state (not a blank or broken layout).
6. An authenticated operator can delete an agent: clicking the Delete button on a row requires an
   explicit confirmation step, then calls `DELETE /api/agents/:id` which removes the record from
   both Anthropic and the DB, and the row disappears from the list without a full page reload.

## Future scope (post v1)

- Create: provision a new agent config by calling the Anthropic API from the UI.
- Update: change model, system prompt, or tools for an existing agent.
- Archive run history on delete (currently the delete is a hard remove).
- Filter / search by role.
- Link from agent row to its recent runs.
