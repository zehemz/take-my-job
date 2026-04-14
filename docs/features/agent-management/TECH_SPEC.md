# Tech Spec — Agent Management (v1: List)

## Scope

Read-only listing of all `AgentConfig` rows. Deferred: create, update, delete.

---

## API

### `GET /api/agents`

Returns all agent configurations. No pagination in v1 (roster is small and bounded by the number of
defined roles).

**Auth:** `auth()` guard required (existing session check).

**Response — `200 OK`**

```ts
// lib/api-types.ts — add:
export interface AgentConfigItem {
  id: string;
  role: string;
  anthropicAgentId: string;
  anthropicAgentVersion: string;
  anthropicEnvironmentId: string;
  createdAt: string; // ISO-8601
}

export type AgentConfigListResponse = AgentConfigItem[];
```

**Response — `401 Unauthorized`** — unauthenticated request.

**Mapping** (`lib/api-mappers.ts`):

```ts
export function mapAgentConfig(row: AgentConfig): AgentConfigItem {
  return {
    id: row.id,
    role: row.role,
    anthropicAgentId: row.anthropicAgentId,
    anthropicAgentVersion: row.anthropicAgentVersion,
    anthropicEnvironmentId: row.anthropicEnvironmentId,
    createdAt: row.createdAt.toISOString(),
  };
}
```

**Route file:** `app/api/agents/route.ts`

```ts
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.agentConfig.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rows.map(mapAgentConfig));
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
Browser → GET /api/agents → auth() → prisma.agentConfig.findMany() → mapAgentConfig[] → JSON
```

No Zustand store needed — this is a read-only admin view. Fetch directly in the server component or
with a simple `useEffect` / SWR call in a client component.

---

## Out of scope (v1)

- Mutations (create / update / delete).
- Optimistic updates.
- Inline editing.
- Pagination.
