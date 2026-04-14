# Tech Spec — Per-Card Environment Override

## Scope

Allow each card to optionally specify an Anthropic environment ID that overrides the default
environment from its agent role's `AgentConfig`. This lets the same agent role (e.g.
`backend-engineer`) run in different sandboxes depending on the task.

## Resolution order

```
card.environmentId  →  (if null)  →  AgentConfig.anthropicEnvironmentId
```

The card-level override is optional. When absent, the existing role-based lookup is preserved.

---

## 1. Database

Add an optional column to `Card`:

```prisma
model Card {
  // ... existing fields
  environmentId  String?   // Optional Anthropic environment ID override
}
```

Migration: `ALTER TABLE "Card" ADD COLUMN "environmentId" TEXT;`

---

## 2. Agent runner

In `lib/agent-runner.ts`, when creating the Anthropic session, prefer the card-level environment:

```ts
const environmentId = card.environmentId ?? agentConfig.anthropicEnvironmentId;
```

---

## 3. RBAC

Update `resolveCardEnvironment()` in `lib/rbac.ts` to accept an optional card-level environment ID:

```ts
export async function resolveCardEnvironment(
  agentRole: string | null,
  cardEnvironmentId?: string | null,
): Promise<string | null> {
  if (cardEnvironmentId) return cardEnvironmentId;
  // ... existing role-based lookup
}
```

Update `guardCardAccess()` and all call sites to pass the card's `environmentId`.

---

## 4. API types

Add `environmentId` to `CreateCardRequest`, `UpdateCardRequest`, and `ApiCard`:

```ts
export interface ApiCard {
  // ... existing
  environmentId: string | null;
}

export interface CreateCardRequest {
  // ... existing
  environmentId?: string;
}

export interface UpdateCardRequest {
  // ... existing
  environmentId?: string | null;
}
```

---

## 5. UI

Add an optional environment dropdown to the card creation/edit form. The dropdown lists available
environments from `GET /api/environments` and includes a "Default (from role)" option.

---

## 6. Board detail route

Update the RBAC environment check in `GET /api/boards/[id]` to use card-level env when present,
falling back to the role-based lookup.
