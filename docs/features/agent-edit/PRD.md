# PRD — Agent Edit (Patch Managed Agents)

## Problem

Kobani operators currently have no way to modify agent configurations after initial provisioning. To change a model, update a system prompt, or adjust a description, they must either run the setup script again or make raw API calls. This is a deployment bottleneck: operators cannot iterate on agent behavior (prompt tuning, model upgrades, description fixes) without leaving the application.

The agent detail page already shows all relevant fields in a read-only 2-column grid. Making those fields editable is the natural next step — operators expect to click, edit, and save without context-switching to a terminal.

## User Stories

1. **As an operator**, I want to change an agent's model from the detail page so I can upgrade or downgrade without redeploying.
2. **As an operator**, I want to edit an agent's system prompt inline so I can iterate on agent behavior quickly.
3. **As an operator**, I want to update the agent's name and description to keep them accurate as the agent's purpose evolves.
4. **As an operator**, I want to change the Kobani role mapping for an agent so I can reassign it to a different kanban role.
5. **As an operator**, I want to be warned when another user has edited the same agent since I loaded the page, so I don't accidentally overwrite their changes.

## Scope

### Phase 1 — Core fields (this PR)

Phase 1 focuses on the fields operators tweak most — identity, model, and prompt — plus the Kobani-specific role mapping. These are flat scalar values with straightforward input types and clear validation rules.

Editable fields: **name**, **description**, **model**, **system** (system prompt), **role** (Kobani DB).

### Phase 2 — Advanced config (future)

Tools, MCP servers, skills, and metadata are complex nested structures. A tools configuration alone involves three different toolset types, each with distinct schemas, enable/disable flags, and per-tool permission policies. Building a proper UI for these is a separate design effort — a JSON editor would be technically correct but hostile to operators who aren't comfortable editing raw JSON.

Deferred fields: **tools**, **mcp_servers**, **skills**, **metadata**.

Phase 2 will be specced separately once Phase 1 is shipped and we have operator feedback on editing patterns.

## Field-by-field decisions

| Field | Editable? | Phase | Input type | Validation | Notes |
|-------|-----------|-------|------------|------------|-------|
| `name` | Yes | 1 | Text input | 1-256 chars, required | Must stay `kobani-` prefixed to match list filter |
| `description` | Yes | 1 | Textarea | 0-2048 chars, nullable | Empty string clears to null |
| `model` | Yes | 1 | Dropdown select | Enum of known models | Options: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`. Speed option stays `standard` in Phase 1 |
| `system` | Yes | 1 | Textarea (expandable) | 0-100,000 chars, nullable | Requires confirmation before saving (high blast radius) |
| `role` | Yes | 1 | Dropdown select | Enum of Kobani roles from `AgentRole` | Kobani-only field. Written to local DB, not sent to Anthropic. `role` has a unique constraint — validation must reject duplicates |
| `version` | No | — | Read-only display | — | Managed by Anthropic. Sent as the concurrency token on every PATCH but never user-editable |
| `tools` | No | 2 | — | — | Complex nested structure. Needs dedicated UI |
| `mcp_servers` | No | 2 | — | — | Complex nested structure. Needs dedicated UI |
| `skills` | No | 2 | — | — | Complex nested structure. Needs dedicated UI |
| `metadata` | No | 2 | — | — | Key-value editor, low priority |
| `anthropicAgentId` | No | — | Read-only display | — | Immutable identifier |
| `createdAt` | No | — | Read-only display | — | Immutable |
| `archivedAt` | No | — | Read-only display | — | Immutable |
| `syncStatus` | No | — | Read-only display | — | Derived from merge logic, not editable |

## UX Design Direction

### Inline editing on the detail page

The detail page already renders fields in a 2-column grid. Editing should happen in-place — not in a separate form page or modal. Each field row transitions from display mode to edit mode when the operator clicks an "Edit" pencil icon next to it.

**Single-field save, not form-wide save.** Each field saves independently via its own PATCH call. Rationale: operators typically tweak one thing at a time (e.g., just the model), and a single-field save avoids the confusion of unsaved state across multiple fields. It also simplifies version conflict handling — each save sends the current `version`, and the response returns the new version, which the UI stores for the next save.

**System prompt gets special treatment.** Because the system prompt has the highest blast radius (changing it fundamentally alters agent behavior), editing it should:
1. Open an expanded textarea (not a single-line inline edit).
2. Show a confirmation dialog before saving: "Changing the system prompt will alter this agent's behavior. Save changes?"
3. Display a character count (out of 100,000 max).

**Model field uses a dropdown.** The set of available models is known and small. A free-text input invites typos. The dropdown displays model names and maps to the `{id, speed}` format required by the API, with speed defaulting to `standard` in Phase 1.

**Role field uses a dropdown.** Populated from the `AgentRole` enum. Since `role` has a unique constraint in the DB, if the operator picks a role already assigned to another agent, the PATCH returns a `409 Conflict` and the UI shows an inline error: "Role already assigned to another agent."

**Loading states (ADR-006).** Every save button must follow ADR-006:
- `disabled={saving}` while the PATCH is in-flight.
- Label changes to "Saving..." while in-flight.
- Classes: `disabled:opacity-60 disabled:cursor-not-allowed`.
- Loading always cleared in `finally`.

### Edit flow summary

```
[Display mode]
  Field label: "Model"    Field value: "claude-sonnet-4-6"    [pencil icon]

→ Click pencil icon

[Edit mode]
  Field label: "Model"    [dropdown: claude-sonnet-4-6 ▼]    [Save] [Cancel]

→ Click Save

[Saving mode]
  Field label: "Model"    [dropdown disabled]    [Saving... (disabled)] [Cancel disabled]

→ Response arrives

[Display mode with new value]
  Field label: "Model"    Field value: "claude-opus-4-6"    [pencil icon]
```

## API Contract

### `PATCH /api/agents/[id]`

Updates one or more fields on a managed agent. Anthropic fields and the Kobani `role` field are handled in a single endpoint but written to different backends.

**Auth:** `auth()` guard required.

**Request body:**

```ts
export interface PatchAgentRequest {
  name?: string;
  description?: string | null;
  model?: string;
  system?: string | null;
  role?: string;
  version: number;
}

export interface PatchAgentResponse {
  agent: AgentDetail;
  newVersion: number;
}
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `200 OK` | Update succeeded. Body contains `PatchAgentResponse`. |
| `400 Bad Request` | Validation failed. |
| `401 Unauthorized` | Not authenticated. |
| `404 Not Found` | Agent ID not found in Anthropic. |
| `409 Conflict` | Version conflict or role uniqueness conflict. |
| `502 Bad Gateway` | Anthropic API unreachable. |

## Edge Cases

### Version conflicts (optimistic concurrency)
The Anthropic API requires `version` on every update and rejects the call if the version does not match.

### Name prefix enforcement
The agent list filters on the `kobani-` prefix. The name input prepends `kobani-` as a fixed prefix (non-editable).

### Empty vs. null for nullable fields
`description` and `system` accept `null` to clear the value. Empty string → send `null`.

### Orphaned agents
Orphaned agents cannot be edited via the Anthropic API. The edit UI is disabled with a message.

## Out of Scope
- Creating new agents from the UI
- Tools, MCP servers, skills, metadata editing (Phase 2)
- Model speed configuration
- Bulk editing
- Audit log
- RBAC for edits
- Real-time collaboration
