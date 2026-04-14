# PRD: Role-Based Access Control (RBAC)

**Product:** Kobani
**Feature:** Role-Based Access Control via User Groups
**Status:** Draft
**Author:** Lucas Bais
**Date:** 2026-04-14

---

## 1. Problem Statement

Kobani currently uses a binary access model: a comma-separated `ALLOWED_GITHUB_USERS` environment variable determines who can sign in, and every authenticated user has identical, unrestricted access to all boards, agents, environments, and cards. There is no concept of roles, groups, or scoped permissions.

This creates three concrete problems as the team grows:

1. **Blast radius of a new user.** Adding someone to the whitelist gives them the ability to move any card into an active column, triggering agent runs against any configured agent and environment. A backend engineer has no business dispatching runs against a QA environment they don't own, but nothing prevents it today.

2. **No separation of concerns between agent domains.** Kobani manages multiple agent roles (backend-engineer, qa-engineer, tech-lead, etc.), each wired to a specific Anthropic agent and environment via `AgentConfig`. In a shared Kobani instance, different people are responsible for different agent domains. There is no way to express "this person manages the backend agents" vs. "this person manages the QA agents."

3. **No admin distinction.** Every authenticated user can do everything, including managing agent configurations (`PATCH /api/agents/:id`). There is no privileged admin role for operations that should be restricted, such as user management or system configuration.

This feature introduces a lightweight group-based RBAC system that scopes user access to specific agent roles and environments, while keeping the system simple enough for a small team tool.

---

## 2. Goals

- Introduce an **admin role** that grants unrestricted access to all resources and the ability to manage users and groups.
- Allow admins to define **user groups** that specify which agent roles and environments the group's members can access.
- **Enforce group permissions** across the UI and API so that users can only see and interact with cards, agents, and environments they have access to.
- Provide an **admin UI** for managing users, groups, and group-to-permission mappings.
- Migrate away from the `ALLOWED_GITHUB_USERS` env var to a database-backed user model, enabling real-time user management without redeployment.

### 2.1 Non-Goals

- **Per-board access control.** All users can see all boards. Scoping board visibility to groups is a possible future extension but is out of scope.
- **Per-card permissions.** Permissions are derived from the card's agent role and environment, not set on individual cards.
- **Custom permission verbs** (read, write, execute, etc.). Access is binary per group: if your group includes an agent role + environment pair, you can do everything with cards that use that pair. There is no read-only mode.
- **Hierarchical roles** beyond admin/member. There is no "group admin" or "viewer" sub-role within a group.
- **LDAP, SAML, or external identity provider integration.** GitHub OAuth remains the sole identity source.
- **Self-service group joining.** Admins assign users to groups; users cannot request or join groups themselves.

---

## 3. User Personas

### 3.1 Admin

The person responsible for operating the Kobani instance. Typically the team lead or platform engineer who deployed it. Admins:

- Have unrestricted access to all boards, cards, agents, environments, and sessions.
- Manage the user list: add users (by GitHub username), remove users, promote users to admin.
- Create and configure groups: define which agent roles and environments each group grants access to.
- Assign users to groups.

### 3.2 Group Member

A team member who uses Kobani day-to-day to manage work items for the agents they are responsible for. Group members:

- See only cards assigned to agent roles they have access to (via their group memberships).
- Can create, edit, move, approve, and retry cards only for agent roles + environments covered by their groups.
- Can view agent configurations and sessions for agents in their groups, but cannot modify agent configs (admin-only).
- May belong to multiple groups, and their effective permissions are the union of all group memberships.

---

## 4. Feature Requirements

### 4.1 Data Model

#### User table

Replace the env-var whitelist with a `User` table in the database:

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid | Primary key |
| `githubUsername` | string (unique) | GitHub login, used as the identity anchor |
| `isAdmin` | boolean (default: false) | Grants unrestricted access when true |
| `createdAt` | datetime | When the user was added |
| `updatedAt` | datetime | Last modification |

The first user to sign in (or a seed user configured via env var) is automatically an admin. Subsequent users must be added by an admin through the UI.

#### Group table

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid | Primary key |
| `name` | string (unique) | Human-readable group name (e.g., "Backend Team", "QA Team") |
| `description` | string (nullable) | Optional description |
| `createdAt` | datetime | When the group was created |
| `updatedAt` | datetime | Last modification |

#### GroupMembership (join table: User <-> Group)

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid | Primary key |
| `userId` | fk -> User | The user |
| `groupId` | fk -> Group | The group |

Unique constraint on `(userId, groupId)`.

#### GroupPermission table

Defines what a group grants access to. Each row represents one allowed (agentRole, environmentId) pair:

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid | Primary key |
| `groupId` | fk -> Group | The group this permission belongs to |
| `agentRole` | string | The agent role (e.g., "backend-engineer", "qa-engineer"). References `AgentConfig.role`. |
| `environmentId` | string | The Anthropic environment ID. References `AgentConfig.anthropicEnvironmentId`. |

Unique constraint on `(groupId, agentRole, environmentId)`.

A user's effective permissions are the union of all `GroupPermission` rows across all groups they belong to.

### 4.2 Access Rules

**Admin users** bypass all permission checks. They see and can interact with everything.

**Non-admin users** are subject to these rules:

1. **Card visibility on the board.** A card is visible to a user only if:
   - The card has no `role` set (unassigned cards are visible to everyone), OR
   - The card's `role` matches an `agentRole` in one of the user's group permissions, AND the `AgentConfig` for that role uses an `environmentId` that also appears in the same group permission row.

2. **Card creation.** A user can create a card with a given role only if they have a group permission covering that role and its configured environment.

3. **Card movement (including to active columns).** A user can move a card only if they have access to the card per rule 1. This is the critical enforcement point -- moving to an active column triggers an agent run and consumes API tokens.

4. **Card approval and revision requests.** Same as rule 1 -- the user must have access to the card's agent role + environment.

5. **Agent config viewing.** Non-admin users can view agent configs for roles in their group permissions. They cannot modify any agent config (admin-only).

6. **Environment viewing.** Non-admin users can view environments referenced in their group permissions. They cannot create or modify environments (admin-only).

7. **Sessions viewing.** Non-admin users can view sessions for agents whose roles are in their group permissions.

8. **Notifications.** Non-admin users only receive and see notifications for cards they have access to.

### 4.3 Backward Compatibility and Migration

- **`ALLOWED_GITHUB_USERS` removal.** The env-var whitelist is removed. All user management moves to the database.
- **Seed admin.** A new env var `SEED_ADMIN_GITHUB_USER` (optional) specifies the GitHub username that is auto-created as an admin on first sign-in. If not set, the first user to sign in through GitHub OAuth becomes the admin.
- **Migration path for existing deployments.** A Prisma migration creates the new tables. A migration script reads `ALLOWED_GITHUB_USERS` (if still set) and creates `User` rows for each username, with the first entry marked as admin. This runs once during the migration and the env var can then be removed.
- **Group-less users.** A user with no group memberships (and `isAdmin: false`) can sign in but sees an empty board (no cards visible) and cannot create cards. The UI should show a message: "You don't have access to any agent groups yet. Contact an admin."

### 4.4 Sign-In Flow Changes

The sign-in flow changes from whitelist-gated to open-registration-with-gating:

- **Option A (invite-only, recommended):** Only users who already have a `User` row in the database can sign in. Admins must add users through the admin UI before they can authenticate. Unknown GitHub usernames are rejected at sign-in with the existing "Access denied" page. This preserves the closed-access model.
- **Option B (open sign-in, group-gated):** Any GitHub user can sign in and gets a `User` row created automatically, but with no group memberships they see nothing useful. Admins then assign them to groups.

**Recommended: Option A.** It matches the current security posture and avoids creating user records for random GitHub users who happen to find the OAuth endpoint.

### 4.5 API Enforcement

Every API route must enforce RBAC:

| Route | Enforcement |
|-------|-------------|
| `GET /api/boards/:id` | Filter cards in response to only those the user has access to |
| `POST /api/boards/:id/cards` | Reject if user lacks permission for the specified role |
| `PATCH /api/cards/:id` | Reject if user lacks permission for the card's role |
| `POST /api/cards/:id/move` | Reject if user lacks permission for the card's role |
| `POST /api/cards/:id/approve` | Reject if user lacks permission for the card's role |
| `POST /api/cards/:id/request-revision` | Reject if user lacks permission for the card's role |
| `POST /api/cards/:id/retry` | Reject if user lacks permission for the card's role |
| `POST /api/cards/:id/reply` | Reject if user lacks permission for the card's role |
| `GET /api/agents` | Filter to roles the user has access to (admin sees all) |
| `PATCH /api/agents/:id` | Admin-only |
| `GET /api/environments` | Filter to environments the user has access to (admin sees all) |
| `PATCH /api/environments/:id` | Admin-only |
| `GET /api/sessions` | Filter to sessions for agents the user has access to |
| `GET /api/notifications` | Filter to notifications for cards the user has access to |
| **New admin routes** | Admin-only (see section 4.6) |

Unauthorized access returns `403 Forbidden` with `{ "error": "Forbidden" }`.

### 4.6 Admin API Routes

New routes for user and group management:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users` | POST | Create a user (body: `{ githubUsername, isAdmin? }`) |
| `/api/admin/users/:id` | PATCH | Update user (toggle admin, etc.) |
| `/api/admin/users/:id` | DELETE | Remove user (cascades group memberships) |
| `/api/admin/groups` | GET | List all groups with member counts |
| `/api/admin/groups` | POST | Create a group |
| `/api/admin/groups/:id` | PATCH | Update group name/description |
| `/api/admin/groups/:id` | DELETE | Delete group (cascades memberships and permissions) |
| `/api/admin/groups/:id/members` | GET | List group members |
| `/api/admin/groups/:id/members` | POST | Add user to group |
| `/api/admin/groups/:id/members/:userId` | DELETE | Remove user from group |
| `/api/admin/groups/:id/permissions` | GET | List group permissions |
| `/api/admin/groups/:id/permissions` | PUT | Replace group permissions (body: array of `{ agentRole, environmentId }`) |

All admin routes require `isAdmin: true` on the authenticated user.

### 4.7 Admin UI

An admin section accessible from the top navigation (visible only to admins):

**Users page (`/admin/users`):**
- Table of all users: GitHub username, avatar, admin badge, groups they belong to, date added.
- "Add User" button opens a form to enter a GitHub username and optionally assign to groups.
- Inline actions: toggle admin, remove user.
- Admins cannot remove themselves (prevent lockout).

**Groups page (`/admin/groups`):**
- Table of all groups: name, description, member count, permission count.
- "Create Group" button.
- Click a group to open its detail page.

**Group detail page (`/admin/groups/:id`):**
- **Members tab:** List of users in the group. Add/remove members.
- **Permissions tab:** Grid or checklist of (agent role, environment) pairs. Each row is an agent role, each column is an environment. Check a cell to grant access to that combination. The available roles and environments are pulled from `AgentConfig` and the environments API.

---

## 5. User Stories

### 5.1 Admin creates a user group

> As an admin, I want to create a group called "Backend Team" that grants access to the `backend-engineer` and `tech-lead` roles in the production environment, so that backend engineers can only manage cards for those agents.

Acceptance criteria:
- Admin navigates to `/admin/groups` and clicks "Create Group."
- Admin enters name "Backend Team" and optional description.
- On the group detail page, admin opens the Permissions tab.
- Admin checks `backend-engineer` and `tech-lead` for the production environment.
- The group is saved. Any user added to this group can now see and interact with cards using those roles.

### 5.2 Admin adds a user and assigns them to a group

> As an admin, I want to add a new team member by their GitHub username and assign them to the "Backend Team" group, so they can start working immediately after their first sign-in.

Acceptance criteria:
- Admin navigates to `/admin/users` and clicks "Add User."
- Admin enters the GitHub username.
- Admin selects one or more groups from a dropdown.
- The user row is created in the database.
- When the new user signs in via GitHub OAuth, they land on the board and see only cards for `backend-engineer` and `tech-lead` roles.

### 5.3 Group member sees only their cards

> As a backend engineer, I want to see only the cards assigned to agent roles I'm responsible for, so I'm not distracted by QA or design work items.

Acceptance criteria:
- On the board view, I see cards for `backend-engineer` and `tech-lead` (my group's roles) and cards with no role assigned.
- Cards for `qa-engineer`, `designer`, etc. are not shown.
- The card count in column headers reflects only visible cards.
- If I navigate directly to a card URL I don't have access to, I get a 403 page.

### 5.4 Group member is blocked from moving an unauthorized card

> As a backend engineer, I do not want to accidentally trigger a QA agent run, because that wastes API tokens and creates confusion.

Acceptance criteria:
- If I somehow obtain a card ID for a `qa-engineer` card (e.g., from a shared link), the API returns 403 when I try to move it.
- The UI does not show move actions for cards outside my permissions.

### 5.5 Admin has unrestricted access

> As an admin, I want to see and manage all cards regardless of group assignments, so I can oversee the entire system.

Acceptance criteria:
- Admin sees all cards on all boards, regardless of role or environment.
- Admin can move, approve, retry, and edit any card.
- Admin can access all agent configs, environments, and sessions.

### 5.6 User with multiple groups gets combined access

> As a user who belongs to both "Backend Team" and "QA Team," I want to see cards for all roles covered by both groups.

Acceptance criteria:
- My visible cards are the union of permissions from both groups.
- Removing me from one group immediately reduces my visible cards to the remaining group's permissions.

### 5.7 Admin prevents self-lockout

> As the only admin, I want to be prevented from removing my own admin status, so I don't accidentally lock everyone out of admin functions.

Acceptance criteria:
- The "toggle admin" action is disabled on my own user row.
- The API returns 400 if an admin tries to set `isAdmin: false` on themselves and they are the last remaining admin.

---

## 6. Success Metrics

| Metric | Target | How to measure |
|--------|--------|----------------|
| Zero unauthorized agent runs | 0 agent runs triggered by users without matching group permissions | Query `AgentRun` + `triggeredBy` against user permissions |
| Admin setup time | < 10 minutes to create groups and add users for a 5-person team | Manual timing during rollout |
| No increase in sign-in friction | Existing users (migrated from whitelist) sign in with no extra steps | Observe first sign-in after migration |
| Zero lockout incidents | No admin accidentally loses access | Count support requests related to access |
| API enforcement coverage | 100% of mutation endpoints enforce RBAC | Automated E2E tests covering each route |

---

## 7. Rollout Plan

### Phase 1: Core RBAC (data model + API enforcement)

**Scope:**
- Prisma schema: `User`, `Group`, `GroupMembership`, `GroupPermission` tables.
- Migration script that reads `ALLOWED_GITHUB_USERS` and seeds `User` rows.
- `SEED_ADMIN_GITHUB_USER` env var for first admin.
- Update NextAuth `signIn` callback to check the `User` table instead of the env var.
- Implement permission-checking utility: `getUserPermissions(githubUsername)` returns the set of `(agentRole, environmentId)` pairs, plus an `isAdmin` flag.
- Add RBAC guards to all existing API routes (per section 4.5).
- Filter board card responses based on user permissions.
- Admin API routes for user and group CRUD (per section 4.6).
- E2E tests covering permission enforcement for each mutation route.

**Deliverables:** Working RBAC enforcement. Admins manage users and groups via API (or a minimal CLI/seed script). No UI yet for admin management.

### Phase 2: Admin UI

**Scope:**
- `/admin/users` page: user list, add user form, toggle admin, remove user.
- `/admin/groups` page: group list, create group.
- `/admin/groups/:id` page: members tab + permissions grid.
- Navigation: "Admin" link in top nav, visible only to admin users.
- Loading states on all mutation buttons per ADR-006.

**Deliverables:** Full admin management UI. `ALLOWED_GITHUB_USERS` env var can be fully deprecated.

### Phase 3: Polish and hardening

**Scope:**
- Audit log for admin actions (who added/removed which user, who changed group permissions).
- Bulk user import (paste a list of GitHub usernames).
- Group cloning (duplicate an existing group's permissions for a new group).
- Permission change notifications (notify users when their access changes).

---

## 8. Open Questions

1. **Card visibility vs. card existence.** Should unauthorized cards be hidden entirely from the board (the user doesn't know they exist) or shown as greyed-out/locked (the user knows they exist but can't interact)? Hidden is simpler and more secure. Greyed-out gives better situational awareness. **Recommendation: hidden**, to keep the implementation simpler and avoid leaking card titles to unauthorized users.

2. **Wildcard permissions.** Should there be a way to grant "all roles" or "all environments" to a group without enumerating each one? This would simplify setup for small teams where one group should see everything but not be admin. **Recommendation: defer to Phase 3.** Admins who want this can just grant admin status for now.

3. **`ALLOWED_GITHUB_USERS` deprecation timeline.** Phase 1 adds the `User` table and migration script. Should the env var remain as a fallback (checked if no `User` table rows exist) or be removed entirely? **Recommendation: remove entirely in Phase 1.** A clean cut avoids dual-path authorization logic. The migration script handles the transition.

4. **Agent role changes.** If an admin changes an `AgentConfig` role name (e.g., renames `backend-engineer` to `backend-dev`), the `GroupPermission` rows referencing the old name become stale. Should `GroupPermission.agentRole` be a foreign key to `AgentConfig.role`, or remain a plain string with manual cleanup? **Recommendation: plain string for now.** `AgentConfig.role` is sourced from Anthropic and may change upstream. A foreign key would create cascading issues. Document that renaming a role requires updating group permissions.

5. **Rate of permission evaluation.** Permissions are checked per-request (unlike the old whitelist which was checked only at sign-in). Is the query cost acceptable? **Recommendation: yes, with caching.** Permissions change rarely. Cache `getUserPermissions()` in memory with a short TTL (60 seconds) or invalidate on admin mutations. The query joins 3 small tables and will have negligible latency for team-sized datasets.
