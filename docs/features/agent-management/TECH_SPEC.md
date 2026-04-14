# Tech Spec — Agent Management (v1: List)

## Scope

Read-only listing of all `AgentConfig` rows. Deferred: create, update, delete.

---

## API

### `GET /api/agents`

Returns agents merged from the live Anthropic API and the local DB role mapping. No pagination in v1
(roster is small and bounded by the number of defined roles).

**Auth:** `auth()` guard required (existing session check).

**Response — `200 OK`**

```ts
// lib/api-types.ts — add:
export type AgentSyncState = "healthy" | "unmapped" | "orphaned";

export interface AgentRow {
  anthropicAgentId: string;
  name: string;
  model: string;
  version: string;
  environmentId: string;
  role: string | null;       // null when unmapped
  syncState: AgentSyncState;
}

export type AgentListResponse = AgentRow[];
```

Sync state semantics:

- **`healthy`** — Anthropic agent exists and has a matching DB role mapping.
- **`unmapped`** — Anthropic agent exists but no `AgentConfig` row maps it to a role.
- **`orphaned`** — `AgentConfig` row exists but the Anthropic API returned no matching agent.

**Response — `401 Unauthorized`** — unauthenticated request.

**Response — `502 Bad Gateway`** — Anthropic API unreachable or returned an error.

**Service layer:** `lib/agents-service.ts`

```ts
// listAgents() fetches live data from Anthropic and joins with DB role mappings.
export async function listAgents(): Promise<AgentRow[]>
```

The route delegates all merge logic to `listAgents()` and does not call
`prisma.agentConfig` directly.

**Route file:** `app/api/agents/route.ts`

```ts
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const agents = await listAgents();
    return NextResponse.json(agents);
  } catch (err) {
    // Anthropic API unreachable or returned an error
    return NextResponse.json({ error: "Failed to reach Anthropic API" }, { status: 502 });
  }
}
```

---

## UI

### Route

`app/agents/page.tsx` — new page, server component that fetches on render.

### Page layout

```
/agents
├── Page heading: "Agents"
├── Subtitle: "Managed agent configurations"
└── AgentConfigTable (client component or plain table)
    ├── Columns: Role | Agent ID | Version | Environment ID | Created
    └── Empty state: "No agents configured. Run scripts/setup-agents.ts to provision."
```

### Component

`app/agents/_components/AgentConfigTable.tsx`

- Renders a `<table>` with one row per `AgentConfigItem`.
- Role column: displays the `role` string, optionally mapped to a human-readable label using the same
  `ROLES` constant from `scripts/setup-agents.ts` (extract to `lib/agent-roles.ts` if shared).
- Agent ID / Environment ID: shown as monospace truncated strings with a copy-to-clipboard button.
- No pagination needed for v1.

### Navigation

Add "Agents" link to the top-level nav (wherever boards link lives).

---

## Data flow

```
Browser → GET /api/agents → auth() → listAgents() → [Anthropic API + prisma.agentConfig] → AgentRow[] → JSON
```

No Zustand store needed — this is a read-only admin view. Fetch directly in the server component or
with a simple `useEffect` / SWR call in a client component.

---

## Out of scope (v1)

- Mutations (create / update / delete).
- Optimistic updates.
- Inline editing.
- Pagination.
