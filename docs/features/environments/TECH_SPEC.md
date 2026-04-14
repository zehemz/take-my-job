# Tech Spec — Environments Management

## Summary

Add an `/environments` page to the app menu that lists all Anthropic environments and allows deleting them, mirroring the existing agents management UX. Anthropic is the source of truth (no DB table needed).

---

## API

### `GET /api/environments`

**Auth:** Required.

**Logic:**
1. Call `beta.environments.list()` (paginate to collect all pages).
2. Filter out archived environments (`archived_at !== null`).
3. Return mapped array.

**Response type** (add to `lib/api-types.ts`):

```ts
export interface EnvironmentRow {
  id: string;
  name: string;
  description: string;
  createdAt: string;       // ISO-8601
  updatedAt: string;       // ISO-8601
  networkType: 'unrestricted' | 'limited';
}
export type EnvironmentListResponse = EnvironmentRow[];
```

### `DELETE /api/environments/[id]`

**Auth:** Required.

**Logic:**
1. Call `beta.environments.delete(id)`.
2. Return `204 No Content`.
3. Handle `404` from Anthropic gracefully — return `204` (already gone).

---

## Routes & Files

| File | Purpose |
|------|---------|
| `app/api/environments/route.ts` | `GET` handler |
| `app/api/environments/[id]/route.ts` | `DELETE` handler |
| `app/environments/page.tsx` | Page component (client) |
| `app/environments/_components/EnvironmentTable.tsx` | Table with delete |
| `lib/api-types.ts` | Add `EnvironmentRow`, `EnvironmentListResponse` |
| `app/_components/TopNav.tsx` | Add "Environments" link |

---

## UI

### TopNav

Add a nav link `Environments` after `Agents`, pointing to `/environments`. Same `text-zinc-400 hover:text-zinc-100 text-sm` style.

### `/environments` Page

Identical structure to `/agents/page.tsx`:
- Fetches on mount, handles `401` redirect.
- Passes items + `handleDelete` to `EnvironmentTable`.

### `EnvironmentTable`

Columns:
| Column | Notes |
|--------|-------|
| Name | plain text |
| Description | truncated, `—` if empty |
| Network | badge: `unrestricted` (green) / `limited` (amber) |
| ID | copyable monospace |
| Created | formatted date |
| Actions | Delete button with spinner + confirmation |

**Delete confirmation:** Inline (no modal) — clicking Delete once shows a confirmation step in the same row (text "Confirm?" + Yes/Cancel buttons), then issues the API call. Follows ADR-006 loading states.

---

## E2E Scenarios

Add to `docs/features/e2e-testing/SCENARIOS.md`:

- Navigate to `/environments` → table renders with at least the columns Name, Network, ID.
- Click Delete on an environment row → confirmation step appears → confirm → row disappears.
- Cancel on confirmation step → row remains unchanged.

---

## Definition of Done

- [x] `GET /api/environments` returns `EnvironmentRow[]`.
- [x] `DELETE /api/environments/[id]` archives/deletes and returns 204.
- [x] `/environments` page renders with correct loading/error states.
- [x] TopNav updated with Environments link.
- [x] Delete flow shows confirmation step per ADR-006.
- [x] E2E scenarios added to SCENARIOS.md.
- [x] TypeScript compiles clean; lint passes.
