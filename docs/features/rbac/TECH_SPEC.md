# RBAC Technical Spec — Role-Based Access Control

**Project:** Kobani
**Date:** 2026-04-14
**Status:** Draft

---

## 1. Overview

Replace the flat `ALLOWED_GITHUB_USERS` env-var allowlist with a database-backed RBAC system. Users are organized into groups; each group grants access to a set of agent roles and environments. A user's effective permissions are the union of all their group memberships. An admin role provides unrestricted access. The first user to sign in after migration is auto-promoted to admin.

### Goals

- Fine-grained access control over which users can interact with which agent roles and environments.
- Admin users can manage users, groups, and assignments without code deploys.
- Backward-compatible migration path from the existing allowlist.
- No breaking changes to the existing API contract shapes.

### Non-goals

- Per-board or per-card ACLs (all access is role+environment scoped).
- Custom permission verbs (e.g., "can approve but not move") -- all access is binary: you can interact with a card or you cannot.
- Multi-tenancy or organization-level isolation.

---

## 2. Database Schema Changes

### New Prisma models

```prisma
model User {
  id              String            @id @default(cuid())
  githubUsername   String            @unique
  isAdmin         Boolean           @default(false)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  groupMemberships UserGroupMember[]
}

model UserGroup {
  id          String                  @id @default(cuid())
  name        String                  @unique
  description String?
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt
  members     UserGroupMember[]
  agentAccess GroupAgentAccess[]
  envAccess   GroupEnvironmentAccess[]
}

model UserGroupMember {
  id        String    @id @default(cuid())
  userId    String
  groupId   String
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  group     UserGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([userId, groupId])
  @@index([userId])
  @@index([groupId])
}

model GroupAgentAccess {
  id        String    @id @default(cuid())
  groupId   String
  agentRole String    // e.g. 'backend-engineer', 'qa-engineer', or '*' for all
  createdAt DateTime  @default(now())
  group     UserGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([groupId, agentRole])
  @@index([groupId])
}

model GroupEnvironmentAccess {
  id            String    @id @default(cuid())
  groupId       String
  environmentId String    // Anthropic environment ID, or '*' for all
  createdAt     DateTime  @default(now())
  group         UserGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([groupId, environmentId])
  @@index([groupId])
}
```

### Why separate access tables instead of JSON arrays

- Queryable: can answer "which groups have access to backend-engineer?" without scanning every row.
- Prisma relations enable cascade deletes when a group is removed.
- Wildcard `'*'` entries grant "all roles" or "all environments" without enumerating each one.

### ER diagram (text)

```
User 1──* UserGroupMember *──1 UserGroup
                                  │
                          ┌───────┴───────┐
                          │               │
                    GroupAgentAccess  GroupEnvironmentAccess
```

---

## 3. Migration Strategy

### Phase 1: Schema migration

Run `npx prisma migrate dev --name add-rbac-models` to create the five new tables. No existing tables are modified.

### Phase 2: Seed from ALLOWED_GITHUB_USERS

A one-time migration script (`prisma/seed-rbac.ts`) reads the existing `ALLOWED_GITHUB_USERS` env var and:

1. Creates a `User` record for each username.
2. Creates a default `UserGroup` named `"legacy-allowlist"` with wildcard access to all agent roles (`agentRole: '*'`) and all environments (`environmentId: '*'`).
3. Adds every existing user as a member of this group.
4. Promotes the first user in the comma-separated list to `isAdmin: true`.

```typescript
// prisma/seed-rbac.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const raw = process.env.ALLOWED_GITHUB_USERS ?? '';
  const usernames = raw.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);

  if (usernames.length === 0) {
    console.log('ALLOWED_GITHUB_USERS is empty, skipping RBAC seed.');
    return;
  }

  // Upsert all users
  const users = await Promise.all(
    usernames.map((username, index) =>
      prisma.user.upsert({
        where: { githubUsername: username },
        update: {},
        create: {
          githubUsername: username,
          isAdmin: index === 0, // first user is admin
        },
      })
    )
  );

  // Create the legacy group with wildcard access
  const group = await prisma.userGroup.upsert({
    where: { name: 'legacy-allowlist' },
    update: {},
    create: {
      name: 'legacy-allowlist',
      description: 'Auto-created from ALLOWED_GITHUB_USERS during RBAC migration',
    },
  });

  // Wildcard agent access
  await prisma.groupAgentAccess.upsert({
    where: { groupId_agentRole: { groupId: group.id, agentRole: '*' } },
    update: {},
    create: { groupId: group.id, agentRole: '*' },
  });

  // Wildcard environment access
  await prisma.groupEnvironmentAccess.upsert({
    where: { groupId_environmentId: { groupId: group.id, environmentId: '*' } },
    update: {},
    create: { groupId: group.id, environmentId: '*' },
  });

  // Add all users to the group
  await Promise.all(
    users.map(user =>
      prisma.userGroupMember.upsert({
        where: { userId_groupId: { userId: user.id, groupId: group.id } },
        update: {},
        create: { userId: user.id, groupId: group.id },
      })
    )
  );

  console.log(`Seeded ${users.length} users into group "${group.name}".`);
  console.log(`Admin: ${usernames[0]}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Phase 3: Update sign-in callback

Replace the `ALLOWED_GITHUB_USERS` env-var check in `auth.ts` with a DB lookup. See section 5 for details.

### Phase 4: Deprecate ALLOWED_GITHUB_USERS

After RBAC is live, `ALLOWED_GITHUB_USERS` becomes optional. If set, it is ignored (but a console warning is emitted on startup). Remove it entirely in a later release.

---

## 4. Permission Resolution Algorithm

### Data model

A user's effective permissions are the **union** of all groups they belong to.

### Types

```typescript
// lib/rbac-types.ts

export interface EffectivePermissions {
  isAdmin: boolean;
  /** Agent roles this user can interact with. null = unrestricted (wildcard). */
  allowedAgentRoles: Set<string> | null;
  /** Environment IDs this user can interact with. null = unrestricted (wildcard). */
  allowedEnvironments: Set<string> | null;
}
```

### Resolution function

```typescript
// lib/rbac.ts
import { prisma } from '@/lib/db';
import type { EffectivePermissions } from './rbac-types';

/**
 * Resolve effective permissions for a GitHub username.
 * Returns null if user does not exist in the User table (unauthorized).
 */
export async function resolvePermissions(
  githubUsername: string
): Promise<EffectivePermissions | null> {
  const user = await prisma.user.findUnique({
    where: { githubUsername: githubUsername.toLowerCase() },
    include: {
      groupMemberships: {
        include: {
          group: {
            include: {
              agentAccess: true,
              envAccess: true,
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  // Admins bypass all checks
  if (user.isAdmin) {
    return { isAdmin: true, allowedAgentRoles: null, allowedEnvironments: null };
  }

  let allRoles = false;
  let allEnvs = false;
  const roles = new Set<string>();
  const envs = new Set<string>();

  for (const membership of user.groupMemberships) {
    const group = membership.group;

    for (const access of group.agentAccess) {
      if (access.agentRole === '*') {
        allRoles = true;
      } else {
        roles.add(access.agentRole);
      }
    }

    for (const access of group.envAccess) {
      if (access.environmentId === '*') {
        allEnvs = true;
      } else {
        envs.add(access.environmentId);
      }
    }
  }

  return {
    isAdmin: false,
    allowedAgentRoles: allRoles ? null : roles,
    allowedEnvironments: allEnvs ? null : envs,
  };
}
```

### Access check utility

```typescript
// lib/rbac.ts (continued)

/**
 * Check whether a user has access to a card's agent role + environment.
 * Used by card mutation routes.
 *
 * @returns true if access is granted, false otherwise.
 */
export async function checkCardAccess(
  githubUsername: string,
  agentRole: string | null,
  environmentId: string | null,
): Promise<boolean> {
  const perms = await resolvePermissions(githubUsername);
  if (!perms) return false;
  if (perms.isAdmin) return true;

  // Check agent role access
  if (agentRole && perms.allowedAgentRoles !== null) {
    if (!perms.allowedAgentRoles.has(agentRole)) return false;
  }

  // Check environment access
  if (environmentId && perms.allowedEnvironments !== null) {
    if (!perms.allowedEnvironments.has(environmentId)) return false;
  }

  return true;
}

/**
 * Resolve the environment ID for a card based on its agent role.
 * Looks up AgentConfig to find the environment the agent is configured to use.
 */
export async function resolveCardEnvironment(
  agentRole: string | null
): Promise<string | null> {
  if (!agentRole) return null;

  const config = await prisma.agentConfig.findUnique({
    where: { role: agentRole },
    select: { anthropicEnvironmentId: true },
  });

  return config?.anthropicEnvironmentId ?? null;
}

/**
 * High-level guard: given a card, check if the user has access.
 * Resolves the environment from the card's agent role automatically.
 */
export async function guardCardAccess(
  githubUsername: string,
  card: { role: string | null },
): Promise<boolean> {
  const environmentId = await resolveCardEnvironment(card.role);
  return checkCardAccess(githubUsername, card.role, environmentId);
}

/**
 * Check if a user is an admin.
 */
export async function isAdmin(githubUsername: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { githubUsername: githubUsername.toLowerCase() },
    select: { isAdmin: true },
  });
  return user?.isAdmin === true;
}

/**
 * Require admin access. Returns a 403 Response if not admin, null if OK.
 * Use in admin-only routes as an early return guard.
 */
export async function requireAdmin(
  githubUsername: string
): Promise<Response | null> {
  if (!(await isAdmin(githubUsername))) {
    return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }
  return null;
}
```

### Performance note: caching

`resolvePermissions` issues a single query with nested includes (1 round trip). For most users with 1-3 group memberships, this is fast enough per-request. If profiling shows this is a bottleneck, add an in-memory LRU cache keyed by `githubUsername` with a 60-second TTL. Do NOT cache in the JWT -- permissions must reflect real-time group changes.

---

## 5. Auth Changes

### Sign-in callback (`auth.ts`)

Replace the env-var allowlist with a DB lookup. The `signIn` callback becomes:

```typescript
// auth.ts — updated signIn callback
callbacks: {
  async signIn({ profile }) {
    const login = (profile?.login as string | undefined) ?? '';
    if (!GITHUB_LOGIN_RE.test(login)) return false;

    const username = login.toLowerCase();

    // Auto-create User record on first sign-in (if not exists)
    // This replaces the ALLOWED_GITHUB_USERS check entirely.
    let user = await prisma.user.findUnique({
      where: { githubUsername: username },
    });

    if (!user) {
      // Check if this is the first-ever user (auto-promote to admin)
      const userCount = await prisma.user.count();

      user = await prisma.user.create({
        data: {
          githubUsername: username,
          isAdmin: userCount === 0, // first user is admin
        },
      });

      // First user also gets the legacy-allowlist group if it exists
      if (userCount === 0) {
        const legacyGroup = await prisma.userGroup.findUnique({
          where: { name: 'legacy-allowlist' },
        });
        if (legacyGroup) {
          await prisma.userGroupMember.create({
            data: { userId: user.id, groupId: legacyGroup.id },
          });
        }
      }
    }

    // User exists in DB -- but do they have any group memberships?
    // A user with zero groups has no access (unless admin).
    if (user.isAdmin) return true;

    const membershipCount = await prisma.userGroupMember.count({
      where: { userId: user.id },
    });

    return membershipCount > 0;
  },

  // jwt and session callbacks unchanged
}
```

### Key behavioral change

- Previously: user must be in `ALLOWED_GITHUB_USERS` env var to sign in.
- Now: user must exist in the `User` table AND belong to at least one group (or be admin).
- Users not in any group are rejected at sign-in with redirect to `/unauthorized`.
- The very first user to sign in is auto-promoted to admin so the system is not locked out.

### Startup validation removal

Remove the `ALLOWED_GITHUB_USERS` startup assertion from `auth.ts`. Replace with a warning if the env var is still set:

```typescript
if (process.env.ALLOWED_GITHUB_USERS?.trim()) {
  console.warn(
    '[kobani] ALLOWED_GITHUB_USERS is set but RBAC is now active. ' +
    'This env var is ignored. Manage access via the admin UI.'
  );
}
```

---

## 6. Session Enrichment

### Decision: do NOT cache permissions in JWT

Permissions are fetched per-request rather than embedded in the JWT. Rationale:

| Approach | Pros | Cons |
|---|---|---|
| JWT-embedded | No DB query on every request | Stale until JWT refresh (up to 24h); JWT size grows; forced logout needed to update permissions |
| Per-request DB lookup | Real-time permission changes; simple JWT | 1 extra DB query per API call |

The per-request approach is chosen because:
1. Admin changes to group assignments must take effect immediately, not after 24 hours.
2. The query is a single indexed lookup with 2-3 small joins (< 1ms on PostgreSQL).
3. The JWT stays small and the auth layer stays simple.

### Session shape (unchanged)

```typescript
{
  user: {
    name: string | null;
    email: string | null;
    githubUsername: string;
    avatarUrl: string;
  };
  expires: string;
}
```

No RBAC data is added to the session object. API routes call `resolvePermissions()` or `guardCardAccess()` as needed.

---

## 7. API Changes

### 7.1 Modified existing routes

Every card mutation route gains an RBAC check after the existing auth guard. Pattern:

```typescript
// Example: POST /api/cards/[id]/move
import { guardCardAccess } from '@/lib/rbac';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existingCard = await prisma.card.findUnique({ where: { id: params.id } });
  if (!existingCard) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  // RBAC check
  const hasAccess = await guardCardAccess(session.user.githubUsername, existingCard);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this agent role/environment' },
      { status: 403 },
    );
  }

  // ... existing logic unchanged
}
```

Routes requiring this change:

| Route | Method | RBAC check |
|---|---|---|
| `/api/cards/[id]/move` | POST | `guardCardAccess(username, card)` |
| `/api/cards/[id]/approve` | POST | `guardCardAccess(username, card)` |
| `/api/cards/[id]/request-revision` | POST | `guardCardAccess(username, card)` |
| `/api/cards/[id]/retry` | POST | `guardCardAccess(username, card)` |
| `/api/cards/[id]/reply` | POST | `guardCardAccess(username, card)` |
| `/api/cards/[id]` | PATCH | `guardCardAccess(username, card)` |
| `/api/boards/[id]/cards` | POST | `checkCardAccess(username, body.role, resolvedEnvId)` |
| `/api/boards/[id]` | GET | Filter cards in response (see below) |
| `/api/agents/*` | ALL | `requireAdmin(username)` |
| `/api/environments/*` | ALL | `requireAdmin(username)` |

### Board detail card filtering

`GET /api/boards/[id]` currently returns all cards. After RBAC, non-admin users see only cards they have access to:

```typescript
// GET /api/boards/[id] — card filtering pseudocode
const perms = await resolvePermissions(session.user.githubUsername);

let cards = await prisma.card.findMany({ where: { boardId: id }, ... });

if (perms && !perms.isAdmin) {
  // Pre-fetch the environment map for all distinct roles in this board's cards
  const distinctRoles = [...new Set(cards.map(c => c.role).filter(Boolean))];
  const agentConfigs = await prisma.agentConfig.findMany({
    where: { role: { in: distinctRoles as string[] } },
    select: { role: true, anthropicEnvironmentId: true },
  });
  const roleToEnv = new Map(agentConfigs.map(c => [c.role, c.anthropicEnvironmentId]));

  cards = cards.filter(card => {
    // Cards with no role are visible to all authenticated users
    if (!card.role) return true;

    const roleOk = perms.allowedAgentRoles === null || perms.allowedAgentRoles.has(card.role);
    const envId = roleToEnv.get(card.role);
    const envOk = !envId || perms.allowedEnvironments === null || perms.allowedEnvironments.has(envId);
    return roleOk && envOk;
  });
}
```

### 7.2 New admin API routes

All admin routes require `requireAdmin()` guard.

#### `GET /api/admin/users`

List all users with their group memberships.

```typescript
// Response shape
interface AdminUserRow {
  id: string;
  githubUsername: string;
  isAdmin: boolean;
  createdAt: string;
  groups: { id: string; name: string }[];
}
```

#### `PATCH /api/admin/users/[id]`

Update user properties (currently only `isAdmin`).

```typescript
// Request
interface UpdateUserRequest {
  isAdmin?: boolean;
}
```

Safety: an admin cannot remove their own admin status (prevent lockout).

#### `DELETE /api/admin/users/[id]`

Remove a user. Cascades to `UserGroupMember` rows. Cannot delete self.

#### `GET /api/admin/groups`

List all groups with member count and access summaries.

```typescript
interface AdminGroupRow {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  agentRoles: string[];   // includes '*' if wildcard
  environments: string[]; // includes '*' if wildcard
  createdAt: string;
}
```

#### `POST /api/admin/groups`

Create a new group.

```typescript
interface CreateGroupRequest {
  name: string;
  description?: string;
  agentRoles: string[];     // e.g. ['backend-engineer', 'qa-engineer'] or ['*']
  environmentIds: string[]; // e.g. ['env_abc123'] or ['*']
}
```

#### `PATCH /api/admin/groups/[id]`

Update group name, description, or access lists. Access lists are replaced wholesale (not merged).

```typescript
interface UpdateGroupRequest {
  name?: string;
  description?: string;
  agentRoles?: string[];
  environmentIds?: string[];
}
```

When `agentRoles` or `environmentIds` is provided, the handler:
1. Deletes all existing `GroupAgentAccess` / `GroupEnvironmentAccess` rows for the group.
2. Creates new rows from the request array.
3. Wraps both operations in a `prisma.$transaction`.

#### `DELETE /api/admin/groups/[id]`

Delete a group. Cascades to members and access rows.

#### `POST /api/admin/groups/[id]/members`

Add a user to a group.

```typescript
interface AddMemberRequest {
  userId: string;
}
```

#### `DELETE /api/admin/groups/[id]/members/[userId]`

Remove a user from a group.

### Route file structure

```
app/api/admin/
  users/
    route.ts                  ← GET (list users)
  users/[id]/
    route.ts                  ← PATCH, DELETE
  groups/
    route.ts                  ← GET (list), POST (create)
  groups/[id]/
    route.ts                  ← PATCH, DELETE
  groups/[id]/members/
    route.ts                  ← POST (add member)
  groups/[id]/members/[userId]/
    route.ts                  ← DELETE (remove member)
```

---

## 8. Middleware Changes

The existing `middleware.ts` handles authentication (is the user signed in?). RBAC (is the user allowed to do this specific thing?) is handled at the route-handler level, not in middleware.

Rationale: middleware runs on every request including page navigations, static assets, and GET requests. RBAC decisions require knowing the specific resource (which card, which agent role), which is only available inside the route handler after parsing the request.

### Admin route protection in middleware

Add `/api/admin/**` to the existing protected matcher. This is already covered by the current catch-all matcher pattern, so no change is needed. The `requireAdmin()` guard in each handler provides the authorization check.

---

## 9. TypeScript Types

### New API types (`lib/api-types.ts` additions)

```typescript
// ── RBAC Admin types ──────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  githubUsername: string;
  isAdmin: boolean;
  createdAt: string;
  groups: { id: string; name: string }[];
}

export type AdminUserListResponse = AdminUserRow[];

export interface UpdateUserRequest {
  isAdmin?: boolean;
}

export interface AdminGroupRow {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  agentRoles: string[];
  environments: string[];
  createdAt: string;
}

export type AdminGroupListResponse = AdminGroupRow[];

export interface CreateGroupRequest {
  name: string;
  description?: string;
  agentRoles: string[];
  environmentIds: string[];
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  agentRoles?: string[];
  environmentIds?: string[];
}

export interface AddGroupMemberRequest {
  userId: string;
}

// ── Card access metadata (returned alongside cards) ──────────────────────────

export interface ApiCard {
  // ... existing fields ...

  /** Whether the current user can perform mutations on this card.
   *  Always true for admins. Based on role + environment access for others. */
  canInteract: boolean;
}
```

---

## 10. Frontend Implications

### 10.1 Card interaction controls

The `canInteract` field on `ApiCard` drives UI behavior:

- **Move (drag-and-drop):** Disable drag handle when `canInteract === false`.
- **Approve / Request Revision / Retry / Reply buttons:** Disable with `disabled:opacity-60 disabled:cursor-not-allowed` per ADR-006.
- **Edit card metadata:** Disable the edit button/form.
- **Tooltip on disabled controls:** Show "You don't have access to this agent role/environment" on hover.

Cards the user cannot interact with are still **visible** on the board (they are returned by GET /api/boards/[id] but with `canInteract: false`). This provides context without cluttering the UI with locked-out indicators. If full hiding is desired, it can be toggled per-user preference later.

### 10.2 Admin pages

New pages under `/admin`:

| Route | Page |
|---|---|
| `/admin/users` | User list with group badges, admin toggle |
| `/admin/groups` | Group list with member count, access summaries |
| `/admin/groups/[id]` | Group detail: edit name/description, manage agent roles, environments, members |

Navigation: add an "Admin" link in the sidebar/header, visible only to admin users. Use a client-side check (fetch `/api/admin/users` -- if 403, hide the link) or embed `isAdmin` in the session.

### 10.3 Session-level admin flag

To avoid a waterfall request to determine admin status on the client, embed `isAdmin` in the session:

```typescript
// auth.ts — updated jwt callback
jwt({ token, profile }) {
  if (profile) {
    token.githubUsername = (profile.login as string) ?? null;
    token.avatarUrl = (profile.avatar_url as string) ?? null;
  }
  // Refresh admin status on every token refresh (piggyback on existing DB check)
  // This runs every ~5 minutes when the session is refreshed
  if (token.githubUsername) {
    // Note: this is async -- Auth.js v5 supports async jwt callbacks
    const user = await prisma.user.findUnique({
      where: { githubUsername: (token.githubUsername as string).toLowerCase() },
      select: { isAdmin: true },
    });
    token.isAdmin = user?.isAdmin ?? false;
  }
  return token;
},

session({ session, token }) {
  session.user.githubUsername = token.githubUsername as string;
  session.user.avatarUrl = token.avatarUrl as string;
  session.user.isAdmin = token.isAdmin as boolean;
  return session;
},
```

Type augmentation update:

```typescript
// types/next-auth.d.ts
declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubUsername: string;
      avatarUrl: string;
      isAdmin: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    githubUsername?: string | null;
    avatarUrl?: string | null;
    isAdmin?: boolean;
  }
}
```

This `isAdmin` flag is used for UI rendering only (show/hide admin link). The server-side `requireAdmin()` guard is the authoritative check.

---

## 11. Dev Auth Bypass Updates

### Updated `DEV_SESSION`

```typescript
// lib/dev-auth.ts
const DEV_SESSION: Session = {
  user: {
    name: 'Dev User',
    email: 'dev@localhost',
    githubUsername: 'dev',
    avatarUrl: '',
    isAdmin: true, // dev user is always admin
  },
  expires: '9999-01-01T00:00:00.000Z',
};
```

### Dev user DB seeding

When `DEV_AUTH_BYPASS=true`, the `devAuth()` function should also ensure the `dev` user exists in the database with admin privileges. Otherwise, `resolvePermissions('dev')` returns null and all RBAC checks fail.

```typescript
// lib/dev-auth.ts
let devUserSeeded = false;

export async function devAuth(): Promise<Session | null> {
  if (process.env.DEV_AUTH_BYPASS === 'true') {
    // Ensure dev user exists in DB (once per process lifetime)
    if (!devUserSeeded) {
      await prisma.user.upsert({
        where: { githubUsername: 'dev' },
        update: { isAdmin: true },
        create: { githubUsername: 'dev', isAdmin: true },
      });
      devUserSeeded = true;
    }
    return DEV_SESSION;
  }
  return auth() as Promise<Session | null>;
}
```

### Optional: DEV_RBAC_ROLE env var

For testing non-admin access in dev mode, support an optional `DEV_RBAC_ROLE` env var:

```bash
# .env.local — test as a non-admin user with only backend-engineer access
DEV_AUTH_BYPASS=true
DEV_RBAC_ROLE=backend-engineer
```

When set, `devAuth()` creates a non-admin dev user with a group granting access only to the specified role(s). This avoids needing a full OAuth flow just to test permission boundaries.

---

## 12. Backward Compatibility

### Transition timeline

| Phase | State | `ALLOWED_GITHUB_USERS` | RBAC tables | Who can sign in |
|---|---|---|---|---|
| 1 - Before migration | Current | Required | Don't exist | Users in env var |
| 2 - Migration deployed | Transition | Read by seed script, then ignored | Populated from env var | Users in DB with group membership |
| 3 - Steady state | Final | Removed from env | Managed via admin UI | Users in DB with group membership |

### No API contract breakage

- All existing response shapes are unchanged.
- `ApiCard` gains one new field (`canInteract: boolean`) which is additive and non-breaking.
- No existing request shapes change.
- HTTP status codes: 403 is new (previously only 401 was returned for auth failures). Clients should already handle 4xx generically.

### Rollback plan

If RBAC must be reverted:
1. Revert the `auth.ts` signIn callback to the env-var check.
2. The RBAC tables remain in the DB but are unused (no foreign keys to existing tables).
3. Remove the RBAC guard calls from route handlers.
4. A `prisma migrate` to drop the tables can follow later.

---

## 13. Error Responses

### New 403 Forbidden response

```json
{
  "error": "Forbidden: no access to this agent role/environment"
}
```

Returned by card mutation routes when the user is authenticated but lacks the required role/environment access.

### New 403 for admin routes

```json
{
  "error": "Forbidden: admin access required"
}
```

Returned by `/api/admin/*` routes when the user is not an admin.

---

## 14. Testing Strategy

### Unit tests

- `resolvePermissions`: test with admin user, user with wildcard group, user with specific roles, user with no groups, non-existent user.
- `guardCardAccess`: test role-only check, environment-only check, both, wildcard, admin bypass.
- `checkCardAccess` edge cases: null role (always allowed), null environment (always allowed).

### Integration tests (API)

- Card move as admin: 200.
- Card move as user with matching role+env: 200.
- Card move as user with matching role but wrong env: 403.
- Card move as user with wrong role: 403.
- Card move as user with no groups: 401 (rejected at sign-in, but test the guard directly).
- Board detail returns only accessible cards for non-admin users.
- Admin CRUD: create group, add user, verify access, remove user, verify denied.

### E2E scenarios

Add to `docs/features/e2e-testing/SCENARIOS.md`:

1. Admin signs in, creates a group with specific role access, adds a user.
2. Non-admin user signs in, sees only cards matching their group access.
3. Non-admin user attempts to move an inaccessible card -- receives 403.
4. Admin removes user from group -- user can no longer interact with previously accessible cards.
5. First-ever user auto-promoted to admin -- can access admin pages.

---

## 15. Implementation Order

1. **Prisma schema** -- add the 5 new models, run migration.
2. **Seed script** -- `prisma/seed-rbac.ts`, run against existing data.
3. **`lib/rbac.ts`** -- permission resolution and guard functions.
4. **`lib/rbac-types.ts`** -- TypeScript types.
5. **`auth.ts`** -- update signIn callback to use DB instead of env var.
6. **`lib/dev-auth.ts`** -- update dev session and auto-seed dev user.
7. **Existing card routes** -- add `guardCardAccess` calls to all 6 mutation routes.
8. **Board detail route** -- add card filtering by permissions.
9. **Agent/environment routes** -- add `requireAdmin` guard.
10. **`lib/api-types.ts`** -- add admin API types and `canInteract` to `ApiCard`.
11. **Admin API routes** -- implement CRUD for users and groups.
12. **Frontend: `canInteract`** -- disable card controls based on the flag.
13. **Frontend: admin pages** -- user management and group management UI.
14. **Session type augmentation** -- add `isAdmin` to session, update `types/next-auth.d.ts`.
15. **Tests** -- unit, integration, E2E scenarios.
16. **Deprecation** -- remove `ALLOWED_GITHUB_USERS` startup assertion, add warning log.

---

## 16. Open Questions

1. **Should users with no matching cards see empty columns or a "no access" banner?** Current spec: they see the board with empty columns where their cards would be. May want a hint.
2. **Audit log for admin actions?** Not in scope for v1, but the `createdAt` fields on membership/access rows provide a basic trail. A dedicated `AuditLog` model could be added later.
3. **Group nesting / inheritance?** Not in scope. Groups are flat. If needed, add a `parentGroupId` self-relation later.
4. **API key / service account access?** Agent dispatch (orchestrator) runs server-side and does not go through RBAC. Only human-initiated API calls are checked.
