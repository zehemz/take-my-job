# RBAC Security Review

**Feature:** Role-Based Access Control  
**Reviewer:** Security Engineer  
**Date:** 2026-04-14  
**Status:** Pre-implementation review  
**Severity ratings:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## 1. Threat Model

### 1.1 Assets under protection

| Asset | Sensitivity | Current protection |
|-------|------------|-------------------|
| Card data (titles, descriptions, acceptance criteria) | Medium | Session-gated via `devAuth()` |
| Card operations (move, approve, retry, reply) | High | Session-gated, no role differentiation |
| Agent configurations (Anthropic agent IDs, system prompts, MCP servers) | High | Session-gated, any authenticated user can PATCH/DELETE |
| Environment listings (Anthropic environment IDs, network configs) | Medium | Session-gated |
| Agent sessions (live Anthropic sessions, `sessionId`) | Critical | Session-gated, exposed in reply flow |
| Admin operations (user/group CRUD) | Critical | Does not exist yet |
| Approval attribution (`approvedBy` field) | High | Server-side from session -- good |

### 1.2 Threat actors

| Actor | Capability | Goal |
|-------|-----------|------|
| **T1: Authenticated non-admin user** | Valid GitHub OAuth session, restricted group membership | Escalate to admin, access agents/environments outside their group |
| **T2: Removed user with cached JWT** | Possesses a valid JWT but has been removed from User table | Continue accessing the system after revocation |
| **T3: Developer using DEV_AUTH_BYPASS** | Full local access with fake session | Accidentally deploy bypass to production |
| **T4: Insider admin** | Full admin access | Modify their own group membership to survive demotion, create backdoor users |
| **T5: GitHub account compromise** | Controls a GitHub account on the allowlist | Full system access under the compromised identity |

### 1.3 Trust boundaries

```
GitHub OAuth --> NextAuth JWT --> devAuth() --> Route handler --> Prisma DB
                    ^                ^               ^
                    |                |               |
              JWT validation    Session check    NEW: RBAC check
              (24h expiry)     (null guard)     (permission eval)
```

The RBAC permission check is a **new trust boundary** that must be enforced consistently across all route handlers. Any route that omits it inherits the current "any authenticated user can do anything" posture.

---

## 2. Authorization Bypass Risks

### RISK-01: Incomplete route coverage (CRITICAL)

**Description:** Every existing API route uses `devAuth()` as a binary authenticated/unauthenticated gate. The RBAC migration must add permission checks to **every** route. If even one route is missed, it becomes an unrestricted backdoor for any authenticated user.

**Affected routes (exhaustive inventory requiring RBAC guards):**

| Route | Method | Required permission |
|-------|--------|-------------------|
| `app/api/cards/[id]/approve/route.ts` | POST | `card:approve` scoped to card's agent role + environment |
| `app/api/cards/[id]/move/route.ts` | POST | `card:move` scoped to card's agent role |
| `app/api/cards/[id]/retry/route.ts` | POST | `card:retry` scoped to card's agent role |
| `app/api/cards/[id]/reply/route.ts` | POST | `card:reply` scoped to card's agent role |
| `app/api/cards/[id]/request-revision/route.ts` | POST | `card:request-revision` scoped to card's agent role |
| `app/api/cards/[id]/route.ts` | GET | `card:read` scoped to card's agent role |
| `app/api/cards/[id]/route.ts` | PATCH | `card:edit` scoped to card's agent role |
| `app/api/cards/[id]/route.ts` | DELETE | `card:delete` scoped to card's agent role |
| `app/api/boards/[id]/cards/route.ts` | GET/POST | `board:read` / `board:write` |
| `app/api/boards/[id]/route.ts` | GET/PATCH/DELETE | `board:manage` |
| `app/api/boards/route.ts` | GET/POST | `board:list` / `board:create` |
| `app/api/agents/route.ts` | GET | `agent:list` (may need to filter by group-accessible roles) |
| `app/api/agents/[id]/route.ts` | GET/PATCH/DELETE | `agent:read` / `agent:edit` / `agent:delete` -- admin only |
| `app/api/environments/route.ts` | GET | `environment:list` (filter by group access) |
| `app/api/environments/[id]/route.ts` | GET/PATCH/DELETE | `environment:manage` -- admin only |
| `app/api/events/[cardId]/route.ts` | GET | `card:read` scoped to card's agent role |
| `app/api/notifications/route.ts` | GET/PATCH | `notification:read` |
| `app/api/sessions/route.ts` | GET | `session:list` |
| **NEW** `app/api/admin/users/*` | ALL | `admin` role only |
| **NEW** `app/api/admin/groups/*` | ALL | `admin` role only |

**Mitigation:** Create a centralized `requirePermission(session, permission, resourceId?)` middleware. Never rely on individual route authors remembering to add checks. See Recommendation R-01.

### RISK-02: Card-level permission scoping gap (HIGH)

**Description:** Cards have a `role` field (e.g., `"designer"`, `"engineer"`). RBAC groups grant access to specific agent roles. However, the card's `role` can be `null` (see schema line 42: `role String?`). A card with `role: null` could either be accessible to everyone or to no one, depending on how the permission check handles nulls.

**Mitigation:** Define explicit policy: cards with `role: null` should either (a) be accessible only to admins, or (b) be accessible to any authenticated user. Document this decision in the TECH_SPEC and test both branches.

### RISK-03: Board-level data leakage through list endpoints (HIGH)

**Description:** `GET /api/boards/[id]/cards` returns all cards on a board. If a user has access to role `"designer"` but not `"engineer"`, the endpoint currently returns **all** cards including those assigned to the `"engineer"` role. The response must be filtered server-side.

**Mitigation:** Apply row-level filtering in the Prisma query. Add a `WHERE role IN (...)` clause derived from the user's group memberships. Admins bypass this filter.

---

## 3. Privilege Escalation

### RISK-04: First-user auto-promotion race condition (CRITICAL)

**Description:** The proposal states "first user auto-promoted to admin." If multiple users sign up simultaneously, the check "is this the first user?" is subject to a race condition:

```
User A: SELECT COUNT(*) FROM "User" --> 0  (no users yet)
User B: SELECT COUNT(*) FROM "User" --> 0  (no users yet)
User A: INSERT INTO "User" ... SET isAdmin = true
User B: INSERT INTO "User" ... SET isAdmin = true  -- BOTH are admin
```

**Mitigation:** Use a database-level mechanism to prevent this:
- Option A: Use a `UNIQUE` partial index or advisory lock when checking user count and inserting.
- Option B: Use a `serializable` transaction isolation level for the first-user check.
- Option C: Use an `INSERT ... ON CONFLICT` pattern with an atomic `CASE WHEN (SELECT COUNT(*) ...) = 0 THEN true ELSE false END` for the `isAdmin` field.

Preferred: Option C -- a single atomic query eliminates the race entirely.

### RISK-05: Self-service group manipulation (HIGH)

**Description:** If the admin API for managing UserGroupMember records does not enforce that only admins can modify group membership, a user could add themselves to a group granting broader access.

**Mitigation:** All `/api/admin/*` routes must verify `user.isAdmin === true` server-side. Never trust a client-side role check alone.

### RISK-06: Admin demotion bypass (MEDIUM)

**Description:** An admin who is being demoted could race to re-promote themselves before the demotion takes effect, or modify the group management code to create a backdoor.

**Mitigation:**
- Prevent the last admin from being demoted (enforce minimum 1 admin invariant).
- Log all admin role changes to an immutable audit trail.
- Consider requiring a second admin to confirm demotion of another admin.

### RISK-07: Role field in PATCH /api/cards/[id] (MEDIUM)

**Description:** The `PATCH /api/cards/[id]` route (line 59) accepts `body.role` and writes it directly to the database. A user could change a card's `role` to one they have access to, effectively re-scoping the card under their permissions. This is a horizontal privilege escalation vector.

**Mitigation:** Only allow `role` changes on cards in inactive columns (already enforced) AND verify the user has access to both the current role and the new role. Admins may change role freely.

---

## 4. Data Exposure

### RISK-08: Agent system prompts and MCP server URLs (HIGH)

**Description:** `GET /api/agents/[id]` returns the full `AgentDetail` including `system` (system prompt) and `mcpServers` (server URLs). System prompts may contain sensitive instructions, and MCP server URLs may expose internal infrastructure. Currently any authenticated user can read any agent's details.

**Mitigation:** Restrict `GET /api/agents/[id]` to:
- Admins: full detail.
- Non-admins: only agents whose `role` matches their group's `GroupAgentAccess`. Strip `system` and `mcpServers` fields from the response for non-admins, or make them admin-only fields.

### RISK-09: Environment details leakage (MEDIUM)

**Description:** `GET /api/environments` returns all environments including network configuration types. Users should only see environments their groups grant access to via `GroupEnvironmentAccess`.

**Mitigation:** Filter the environment list by the user's `GroupEnvironmentAccess` entries. Return 200 with an empty list (not 403) for users with no environment access -- this avoids leaking the existence of environments.

### RISK-10: Notification content leaking card titles (LOW)

**Description:** `GET /api/notifications` returns notifications for all cards on a board. Notification messages may contain card titles or details for cards the user should not see.

**Mitigation:** Filter notifications to only those whose associated card is within the user's role scope.

---

## 5. Race Conditions (TOCTOU)

### RISK-11: Permission check vs. operation execution gap (MEDIUM)

**Description:** A common pattern in the existing routes is:

```typescript
// 1. Check permission (proposed)
const canApprove = await checkPermission(session, 'card:approve', card.role);
// 2. Execute operation
const updatedCard = await prisma.card.update({ ... });
```

Between steps 1 and 2, the user's permissions could be revoked (e.g., removed from a group), or the card's role could change. This is a classic Time-of-Check-Time-of-Use (TOCTOU) issue.

**Mitigation:** For most operations, the window is milliseconds and the risk is acceptable. For high-impact operations (approve, delete agent), consider wrapping the permission check and mutation in a database transaction. The card `approve` route already sets `approvedBy` from the session server-side, which is correct.

### RISK-12: Group membership caching in JWT (HIGH)

**Description:** If group memberships or roles are cached in the JWT token, permission revocation will not take effect until the JWT expires (currently 24 hours per `auth.ts` line 26). A removed user retains full access for up to 24 hours.

**Mitigation:** See Section 6 for JWT vs. DB lookup tradeoffs.

---

## 6. Session / JWT Considerations

### 6.1 Option A: Cache roles in JWT

| Pro | Con |
|-----|-----|
| No DB query per request | Stale permissions for up to 24h |
| Faster response times | JWT size increases with group data |
| Simpler implementation | No way to revoke access immediately |

### 6.2 Option B: DB lookup on every request

| Pro | Con |
|-----|-----|
| Permissions always current | 1 extra DB query per request |
| Instant revocation | Slightly higher latency |
| JWT stays small | Requires DB availability for auth |

### 6.3 Recommendation: Hybrid approach (RECOMMENDED)

Cache the `isAdmin` boolean and `userId` in the JWT. On each request:

1. Read `userId` from JWT (fast, no DB hit).
2. If the route requires specific group-level permissions, query `GroupAgentAccess` / `GroupEnvironmentAccess` from DB.
3. If the user is admin (from JWT), skip group checks.
4. For admin status changes, force a token refresh by setting a `permissionsVersion` field on the User record. Compare it against the JWT's cached version -- if stale, re-query and issue a new JWT.

This gives O(1) admin checks while keeping group permissions always-fresh. The `permissionsVersion` mechanism allows near-instant admin revocation without waiting for JWT expiry.

---

## 7. Dev Bypass Implications

### RISK-13: DEV_AUTH_BYPASS role assignment (HIGH)

**Description:** The current `devAuth()` in `lib/dev-auth.ts` returns a hardcoded `DEV_SESSION` with `githubUsername: 'dev'`. Under RBAC, this fake user needs a role. If the dev bypass automatically gets admin privileges, and the bypass accidentally ships to production, any unauthenticated request gets full admin access.

**Current code (lib/dev-auth.ts):**
```typescript
const DEV_SESSION: Session = {
  user: {
    name: 'Dev User',
    email: 'dev@localhost',
    githubUsername: 'dev',
    avatarUrl: '',
  },
  expires: '9999-01-01T00:00:00.000Z',
};
```

**Mitigations:**
1. The dev bypass session MUST include RBAC fields (e.g., `isAdmin: true`, `userId: 'dev-user-id'`).
2. Add a startup check: if `NODE_ENV === 'production'` and `DEV_AUTH_BYPASS === 'true'`, **refuse to start the server** and log a CRITICAL error.
3. Add a CI lint rule that fails if `DEV_AUTH_BYPASS` appears in any production deployment configuration.
4. The dev bypass user should be a real record in the DB (seeded during dev setup), not a phantom identity that bypasses the User table entirely.

### RISK-14: Dev bypass user not in User table (MEDIUM)

**Description:** Since the dev bypass returns a session without a corresponding User record in the database, any RBAC query like `SELECT * FROM "User" WHERE githubUsername = 'dev'` will return null. Permission checks will fail or behave unexpectedly.

**Mitigation:** The dev seed script must create a User record for `githubUsername: 'dev'` with `isAdmin: true` and membership in an "all access" group.

---

## 8. Migration Risks

### RISK-15: Transition window with dual auth systems (CRITICAL)

**Description:** During migration from `ALLOWED_GITHUB_USERS` to DB-backed RBAC, there will be a period where the system must handle:
- Users in `ALLOWED_GITHUB_USERS` who do not yet have a User record.
- Users with a User record but not in `ALLOWED_GITHUB_USERS` (should not happen, but could if the env var is modified independently).

If the migration is not atomic, there is a window where either everyone is locked out or the RBAC checks are not enforced.

**Migration strategy (recommended):**

1. **Phase 1 -- Additive only.** Deploy the new User/Group tables. Keep `ALLOWED_GITHUB_USERS` as the gatekeeper in `auth.ts signIn()`. Auto-create User records on first login for anyone in the allowlist. First user to log in becomes admin.
2. **Phase 2 -- Shadow mode.** Run RBAC permission checks in parallel but log-only (do not enforce). Compare RBAC decisions against the current "allow all authenticated users" behavior. Alert on discrepancies.
3. **Phase 3 -- Enforce.** Flip RBAC enforcement on. Keep `ALLOWED_GITHUB_USERS` as a secondary gate in the `signIn()` callback for defense-in-depth.
4. **Phase 4 -- Remove allowlist.** Once confident, remove `ALLOWED_GITHUB_USERS` and rely solely on the User table for sign-in authorization.

### RISK-16: Data migration leaves orphaned permissions (LOW)

**Description:** If `ALLOWED_GITHUB_USERS` contains usernames that never log in, they will never get User records. If the allowlist is later removed, these users silently lose access. This is acceptable but should be documented.

**Mitigation:** During Phase 3, log a warning for each `ALLOWED_GITHUB_USERS` entry that does not have a corresponding User record. Notify admins to invite or remove these users.

### RISK-17: Existing approvedBy values reference GitHub usernames, not User IDs (LOW)

**Description:** The `approvedBy` field on cards stores `session.user.githubUsername` (a string like `"octocat"`). If RBAC introduces a User table with `id` as the primary key, there is a question of whether `approvedBy` should reference the User ID or continue using the GitHub username.

**Mitigation:** Keep `approvedBy` as a GitHub username string for backward compatibility. Add a new `approvedByUserId` field if you need a foreign key relationship. Do not silently change the semantics of existing fields.

---

## 9. Recommendations

### R-01: Centralized permission middleware (CRITICAL)

Create a single `requirePermission()` function that all route handlers call after `devAuth()`. This eliminates the risk of individual routes forgetting to check permissions.

```typescript
// lib/rbac.ts
export async function requirePermission(
  session: Session,
  permission: string,
  resourceContext?: { agentRole?: string; environmentId?: string },
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Look up User by session.user.githubUsername
  // 2. If user.isAdmin, return { allowed: true }
  // 3. Query user's groups and their access grants
  // 4. Check if any grant covers the requested permission + resource
  // 5. Return { allowed: false, reason: '...' } if denied
}
```

Every route handler becomes:

```typescript
const session = await auth();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

const perm = await requirePermission(session, 'card:approve', { agentRole: card.role });
if (!perm.allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

### R-02: Audit logging (HIGH)

Log all permission-sensitive operations to an audit table:
- Admin role grants/revocations
- Group membership changes
- Card approvals (already tracked via `approvedBy`)
- Agent configuration changes (PATCH, DELETE on `/api/agents/[id]`)
- Failed authorization attempts (log the denied permission and user)

### R-03: Deny by default (CRITICAL)

The permission system must be **deny by default**. If a user has no group memberships, they should see an empty board. If a permission check encounters an error (DB timeout, malformed data), it must deny access, not fail open.

### R-04: Rate limit admin operations (MEDIUM)

Admin endpoints (user CRUD, group CRUD) should have stricter rate limits than regular operations to slow down automated privilege escalation attempts.

### R-05: Input validation on group/user management (MEDIUM)

All admin API inputs must be validated:
- GitHub usernames: enforce the existing `GITHUB_LOGIN_RE` pattern (`/^[a-z0-9-]{1,39}$/i` from `auth.ts` line 4).
- Group names: alphanumeric + hyphens, max 64 characters.
- Role names in `GroupAgentAccess`: validate against known agent roles from `AgentConfig.role`.

### R-06: Prevent admin lockout (HIGH)

Enforce a database constraint or application-level check that at least one admin user always exists. The `DELETE /api/admin/users/:id` and `PATCH /api/admin/users/:id` routes must refuse to remove admin status from the last admin.

### R-07: Return 403, not 404, for authorization failures (MEDIUM)

When a user does not have permission to access a resource, return `403 Forbidden`, not `404 Not Found`. Returning 404 for existing resources the user cannot access technically leaks less information about resource existence, but in this system all users are authenticated team members and consistent 403 responses are more debuggable. Choose one approach and apply it consistently.

**Exception:** For truly sensitive resources where existence itself is information, 404 may be appropriate. Document the choice per endpoint.

### R-08: Protect the orchestrator path (HIGH)

The orchestrator (`lib/orchestrator-instance.ts`) is called from route handlers like `move` and `reply` via `orchestrator.notifyCardMoved()` and `orchestrator.notifyCardUnblocked()`. These internal calls are not HTTP-gated but are triggered by HTTP requests. Ensure the RBAC check happens **before** any orchestrator call, not after. A denied request must never trigger an orchestrator side effect.

---

## 10. Implementation Security Checklist

Use this checklist during code review of the RBAC implementation:

### Schema and migrations

- [ ] `User` table has a `NOT NULL` constraint on `githubUsername` with a `UNIQUE` index
- [ ] `User.isAdmin` defaults to `false`
- [ ] `UserGroupMember` has a composite unique index on `(userId, groupId)` to prevent duplicate memberships
- [ ] `GroupAgentAccess` has a composite unique index on `(groupId, agentRole)` to prevent duplicate grants
- [ ] `GroupEnvironmentAccess` has a composite unique index on `(groupId, environmentId)`
- [ ] First-user admin promotion uses an atomic query (no race condition)
- [ ] Migration is backward-compatible -- existing data is not broken by the schema change

### Authentication layer

- [ ] `devAuth()` updated to include RBAC fields (`userId`, `isAdmin`) in the session
- [ ] Dev bypass user has a corresponding seed record in the User table
- [ ] Production startup fails if `DEV_AUTH_BYPASS=true` and `NODE_ENV=production`
- [ ] JWT `maxAge` remains 24h (line 26 of `auth.ts`) -- not extended
- [ ] `signIn()` callback creates User record on first login if it does not exist

### Permission checks

- [ ] `requirePermission()` function exists in `lib/rbac.ts`
- [ ] Every route in `app/api/` calls `requirePermission()` after `auth()`
- [ ] Permission check runs BEFORE any database mutation or orchestrator call
- [ ] Permission check runs BEFORE `req.json()` body parsing on mutation routes (avoid parsing cost on unauthorized requests)
- [ ] Deny by default -- unknown permissions return `false`
- [ ] Admin bypass is checked via DB `isAdmin` field, not a hardcoded username list
- [ ] `card:approve` checks the card's `role` against the user's group agent access
- [ ] `card:move` checks the card's `role` against the user's group agent access
- [ ] `card:retry` checks the card's `role` against the user's group agent access
- [ ] `card:reply` checks the card's `role` against the user's group agent access
- [ ] `card:edit` checks that the user has access to both the current and new `role` (if `role` is being changed)
- [ ] `GET /api/agents` filters results by group-accessible roles for non-admins
- [ ] `GET /api/environments` filters results by group-accessible environments for non-admins
- [ ] `GET /api/boards/[id]/cards` filters cards by role for non-admins
- [ ] `GET /api/notifications` filters by accessible card roles

### Admin routes

- [ ] All `/api/admin/*` routes verify `user.isAdmin === true` server-side
- [ ] Cannot delete or demote the last admin
- [ ] Cannot create a user with `isAdmin: true` unless the requester is admin
- [ ] Group membership changes are logged to an audit table
- [ ] GitHub username validation uses the existing `GITHUB_LOGIN_RE` pattern
- [ ] Bulk operations (if any) are atomic -- partial failures do not leave inconsistent state

### Response filtering

- [ ] Agent `system` prompt and `mcpServers` are stripped from non-admin responses
- [ ] Card list responses only include cards matching the user's role scope
- [ ] Error messages do not leak information about resources the user cannot access

### Testing

- [ ] Unit tests for `requirePermission()` covering: admin bypass, group match, group miss, null role, no groups
- [ ] Integration tests for each API route with an unauthorized user (expect 403)
- [ ] Integration test for first-user auto-admin with concurrent requests
- [ ] Integration test for permission revocation mid-session
- [ ] E2E test: non-admin user cannot access admin routes
- [ ] E2E test: non-admin user can only see cards matching their group roles
- [ ] E2E test: removing a user from a group immediately restricts their access

---

## Appendix: Route-to-Permission Mapping

For quick reference during implementation:

```
POST   /api/cards/[id]/approve           -> card:approve   (scoped by card.role)
POST   /api/cards/[id]/move              -> card:move      (scoped by card.role)
POST   /api/cards/[id]/retry             -> card:retry     (scoped by card.role)
POST   /api/cards/[id]/reply             -> card:reply     (scoped by card.role)
POST   /api/cards/[id]/request-revision  -> card:revise    (scoped by card.role)
GET    /api/cards/[id]                   -> card:read      (scoped by card.role)
PATCH  /api/cards/[id]                   -> card:edit      (scoped by card.role)
DELETE /api/cards/[id]                   -> card:delete     (scoped by card.role)
GET    /api/boards/[id]/cards            -> board:read      (row-filter by card.role)
POST   /api/boards/[id]/cards            -> card:create     (scoped by submitted role)
GET    /api/boards/[id]                  -> board:read
GET    /api/boards                       -> board:list
POST   /api/boards                       -> board:create    (admin only)
GET    /api/agents                       -> agent:list      (row-filter by role)
GET    /api/agents/[id]                  -> agent:read      (scoped by agent role)
PATCH  /api/agents/[id]                  -> agent:edit      (admin only)
DELETE /api/agents/[id]                  -> agent:delete     (admin only)
GET    /api/environments                 -> env:list        (row-filter by group access)
GET    /api/environments/[id]            -> env:read        (scoped by group access)
GET    /api/events/[cardId]              -> card:read       (scoped by card.role)
GET    /api/notifications                -> notification:read (row-filter by card.role)
GET    /api/sessions                     -> session:list
ALL    /api/admin/users/*                -> admin
ALL    /api/admin/groups/*               -> admin
```
