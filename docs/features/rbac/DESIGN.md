# RBAC UX Design — Kobani

Role-based access control: users, groups, and per-agent/per-environment permissions enforced across the platform.

---

## 1. Design Principles

**Visibility over concealment.**
The kanban board never hides cards the user cannot act on. Every card remains visible so users retain full situational awareness. Cards outside the user's access are visually muted, not removed. The board is a shared map; RBAC determines what you can touch, not what you can see.

**Progressive disclosure of admin surfaces.**
The "Access" nav link and all admin management pages are invisible to non-admin users. Admins see the full control surface; members see only the access-restriction indicators on entities they interact with. No "you don't have permission to view this page" dead ends — the page simply does not exist in the nav for non-admins.

**Groups are the unit of policy.**
Individual users are never granted per-agent or per-environment access directly. All permissions flow through groups. This keeps the mental model simple: assign a user to a group, the group defines what agents and environments are reachable. The admin pages reinforce this by making groups the primary management surface, with users as a secondary roster view.

**Restrictions explain themselves.**
Every disabled button or muted card carries a tooltip that states the reason. "No access to agent backend-engineer" is better than a generic "Permission denied". The user should never wonder *why* something is greyed out.

**Inherit the existing palette without exception.**
Background `zinc-950`, surfaces `zinc-900`, borders `zinc-800`/`zinc-700`, primary text `zinc-100`, secondary `zinc-400`/`zinc-500`, accent `indigo-600`. Admin badges use `amber-500`/`amber-900` to distinguish the admin role from operational statuses. No new hues are introduced.

---

## 2. Navigation Changes

### 2a. TopNav addition

A new "Access" link appears in the centre nav group, after the existing "Environments" link. It is only rendered when the current user has the `admin` role.

```
Kobani / Board Name  |  Agents · Sessions · Environments · Access    [bell] [avatar] [···]
```

Classes for the new link follow the existing pattern exactly:

```
text-zinc-400 hover:text-zinc-100 transition-colors text-sm shrink-0
```

Active state: `text-zinc-100` when `pathname.startsWith('/access')`.

The `·` separator between "Environments" and "Access" uses the same `text-zinc-700 mx-1 shrink-0` span as existing separators.

### 2b. Conditional rendering

TopNav reads the user role from the session (available via `useSession()`). If `session.user.role !== 'admin'`, the "Access" link and its preceding separator are not rendered. No placeholder, no disabled link — the DOM element does not exist.

### 2c. Admin badge in UserMenu dropdown

When the signed-in user is an admin, the username row in the UserMenu dropdown gains a small badge:

```
┌──────────────────────┐
│  @username  ADMIN    │  <- "ADMIN" badge inline after username
│  ─────────────────── │
│  Sign out            │
└──────────────────────┘
```

Badge classes: `text-[10px] font-bold uppercase tracking-wider bg-amber-900 text-amber-400 px-1.5 py-0.5 rounded ml-1.5`

This badge confirms the user's elevated role without requiring them to navigate to a settings page.

---

## 3. Page Layouts

All admin pages share the same shell as existing management pages (Agents, Environments): `TopNav` at the top, content area `flex-1 px-8 py-8`, no max-width constraint. The "Access" section uses a tabbed layout to switch between Users and Groups.

### 3a. Access page shell (`/access`)

```
┌──────────────────────────────────────────────────────────────────┐
│  TopNav                                                          │
├──────────────────────────────────────────────────────────────────┤
│  px-8 py-8                                                       │
│                                                                  │
│  h1  "Access Control"                text-xl font-semibold       │
│  p   "Manage users, groups, and permissions."                    │
│      text-sm text-zinc-500 mt-1                                  │
│                                                                  │
│  ┌──────────┬──────────┐                                         │
│  │  Users   │  Groups  │  <- tab bar                             │
│  └──────────┴──────────┘                                         │
│  ────────────────────────────────── border-b border-zinc-800     │
│                                                                  │
│  [ Tab content: UsersTable or GroupsTable ]                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Tab bar** — Two inline tab buttons, no router navigation (client-side tab switch using local state). This avoids polluting the URL for an admin-only view and keeps the page snappy.

Tab button (inactive): `px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer border-b-2 border-transparent`

Tab button (active): `px-4 py-2 text-sm text-zinc-100 font-medium border-b-2 border-indigo-500 cursor-default`

The tab bar sits in a `flex gap-0` container with `border-b border-zinc-800` on the wrapper div so the active indicator overlaps the shared border.

---

### 3b. Users tab

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Search: [____________________________]   [Invite User]   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  USERNAME       GROUPS           ROLE     LAST ACTIVE      │  │
│  │ ──────────────────────────────────────────────────────── │  │
│  │  @zehemz        platform-eng     Admin    2 hours ago      │  │
│  │                 infra-ops        [badge]                    │  │
│  │ ──────────────────────────────────────────────────────── │  │
│  │  @lbais         platform-eng     Member   5 min ago        │  │
│  │ ──────────────────────────────────────────────────────── │  │
│  │  @agent-svc     ci-agents        Member   Just now         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

#### Search input

Position: above the table, left-aligned, `flex items-center gap-3 mb-4`.

Input classes: `bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-72`

Placeholder: `"Search users..."`

The search filters the table client-side by username (case-insensitive substring match). Debounce: 200 ms.

#### Invite User button

Position: right side of the search row, `ml-auto`.

Classes: `bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`

Clicking opens the Invite User modal (see Section 4c).

#### Users table

Container: `rounded-lg border border-zinc-800 overflow-hidden` — matches EnvironmentTable.

| # | Header | Data | Width hint |
|---|--------|------|------------|
| 1 | Username | GitHub login with avatar | `w-48` |
| 2 | Groups | Comma-separated group names, each as a pill | `min-w-[200px]` |
| 3 | Role | "Admin" or "Member" badge | `w-24` |
| 4 | Last Active | Relative time | `w-32` |

**Username cell** — `flex items-center gap-2`:

1. GitHub avatar: `w-6 h-6 rounded-full object-cover`. Fallback: indigo initials circle (same pattern as `UserMenu`).
2. `@{login}` in `font-mono text-sm text-zinc-100`.
3. If admin: the amber "ADMIN" badge (same spec as Section 2c) appears inline after the username.

**Groups cell** — Each group rendered as a small pill:

Pill classes: `inline-flex items-center bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-md mr-1.5 mb-1`

If the user belongs to zero groups: `text-zinc-600 italic text-xs` showing "No groups".

**Role cell** — A single badge:

- Admin: `bg-amber-900 text-amber-400 border-l-4 border-l-amber-500 rounded-md px-2 py-0.5 text-xs font-semibold`
- Member: `bg-zinc-700 text-zinc-300 border-l-4 border-l-zinc-500 rounded-md px-2 py-0.5 text-xs font-semibold`

**Last Active cell** — `text-xs text-zinc-500`, using the same `relativeTime` helper from `lib/timeUtils.ts`.

**Row hover:** `hover:bg-zinc-800/50 transition-colors` — matches existing tables.

**Row click:** Clicking a user row opens the inline user detail drawer (see Section 3d).

---

### 3c. Groups tab

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Search: [____________________________]  [Create Group]   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  GROUP NAME     MEMBERS   AGENTS          ENVIRONMENTS     │  │
│  │ ──────────────────────────────────────────────────────── │  │
│  │  platform-eng   3         backend-eng     production       │  │
│  │                           qa-engineer     staging          │  │
│  │                           tech-lead                        │  │
│  │ ──────────────────────────────────────────────────────── │  │
│  │  ci-agents      1         ci-runner       ci               │  │
│  │ ──────────────────────────────────────────────────────── │  │
│  │  infra-ops      2         All agents      All envs         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

#### Create Group button

Same primary button pattern as "Invite User". Label: "Create Group". Opens the Create Group modal (Section 4d).

#### Groups table

Container: same as Users table.

| # | Header | Data | Width hint |
|---|--------|------|------------|
| 1 | Group Name | Name string | `w-40` |
| 2 | Members | Numeric count | `w-24` |
| 3 | Agents | List of agent roles the group can access | `min-w-[200px]` |
| 4 | Environments | List of environment names the group can access | `min-w-[200px]` |

**Group Name cell** — `text-sm font-medium text-zinc-100`.

**Members cell** — `text-sm text-zinc-400`. Plain number. e.g. "3 members".

**Agents cell** — Each agent role rendered as a pill (same pill classes as group pills in the Users table). If the group has access to all agents: a single pill `bg-emerald-900 text-emerald-300 text-xs` reading "All agents".

**Environments cell** — Same pill pattern. "All environments" uses the same emerald treatment.

**Row click:** Navigates to the Group Detail page (`/access/groups/[id]`).

---

### 3d. User detail drawer

When a user row is clicked in the Users tab, a right-side drawer slides in (same pattern as existing card detail interaction). This avoids a full page navigation for a quick view.

```
┌──────────────────────────────────────────────┬───────────────────┐
│                                              │  User Detail      │
│  (Users table, dimmed)                       │                   │
│                                              │  [avatar]         │
│                                              │  @zehemz          │
│                                              │  Role: Admin [v]  │
│                                              │                   │
│                                              │  GROUPS           │
│                                              │  [x] platform-eng │
│                                              │  [x] infra-ops    │
│                                              │  [ ] ci-agents    │
│                                              │                   │
│                                              │  ─────────────    │
│                                              │  [Remove User]    │
│                                              │                   │
└──────────────────────────────────────────────┴───────────────────┘
```

**Drawer container:** `fixed top-0 right-0 h-screen w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl z-40 overflow-y-auto`

Enters with a `translate-x-full -> translate-x-0` transition (`transition-transform duration-200 ease-out`).

**Backdrop:** `fixed inset-0 bg-black/40 z-30`. Clicking closes the drawer.

**Content layout (top to bottom):**

1. **Header row:** `flex items-center justify-between px-6 py-4 border-b border-zinc-800`
   - Left: `text-lg font-semibold text-zinc-100` — "User Detail"
   - Right: close button `text-zinc-400 hover:text-zinc-100 cursor-pointer` — X icon

2. **Avatar + username block:** `px-6 py-5 flex items-center gap-3`
   - Avatar: `w-12 h-12 rounded-full`. GitHub avatar or indigo initials fallback.
   - Username: `font-mono text-base text-zinc-100`
   - Admin badge (if applicable)

3. **Role selector:** `px-6 py-3`
   - Label: `text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2` — "Role"
   - Select dropdown: `bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 w-full`
   - Options: "Admin", "Member"
   - Changing the role triggers an immediate save with loading state on the select (per ADR-006: `disabled:opacity-60 disabled:cursor-not-allowed`, brief "Saving..." label is not applicable to selects, so instead the select is disabled while the mutation is in-flight).

4. **Groups section:** `px-6 py-4`
   - Label: `text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3` — "Groups"
   - Each group as a checkbox row: `flex items-center gap-2 py-1.5`
     - Checkbox: `w-4 h-4 rounded bg-zinc-950 border border-zinc-700 accent-indigo-600 cursor-pointer`
     - Group name: `text-sm text-zinc-300`
   - Checking/unchecking a group saves immediately (optimistic update, revert on failure).

5. **Danger zone:** `px-6 py-4 mt-auto border-t border-zinc-800`
   - "Remove User" button: `text-red-400 hover:text-red-300 text-sm cursor-pointer`
   - Follows the confirm pattern from EnvironmentTable's `RowDeleteCell`: idle -> "Confirm?" with Yes/Cancel -> "Removing..." with spinner.

---

### 3e. Group detail page (`/access/groups/[id]`)

A dedicated page (not a drawer) because groups carry more configuration than a user's role assignment.

```
┌──────────────────────────────────────────────────────────────────┐
│  TopNav                                                          │
├──────────────────────────────────────────────────────────────────┤
│  px-8 py-8                                                       │
│                                                                  │
│  <- Back to Access          text-sm text-zinc-400 hover:zinc-100 │
│                                                                  │
│  h1  "platform-eng"                  text-xl font-semibold       │
│  p   "3 members · 3 agents · 2 environments"                    │
│      text-sm text-zinc-500 mt-1                                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  MEMBERS                                              [+]  │ │
│  │ ─────────────────────────────────────────────────────────── │ │
│  │  [avatar] @zehemz        Admin         [x remove]          │ │
│  │  [avatar] @lbais         Member        [x remove]          │ │
│  │  [avatar] @agent-svc     Member        [x remove]          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │  AGENT ACCESS            │  │  ENVIRONMENT ACCESS          │ │
│  │ ──────────────────────── │  │ ──────────────────────────── │ │
│  │  [x] backend-engineer    │  │  [x] production              │ │
│  │  [x] qa-engineer         │  │  [x] staging                 │ │
│  │  [x] tech-lead           │  │  [ ] ci                      │ │
│  │  [ ] ci-runner           │  │                              │ │
│  │                          │  │  ┌────────────────────────┐  │ │
│  │  ┌────────────────────┐  │  │  │ [x] Grant all          │  │ │
│  │  │ [x] Grant all      │  │  │  └────────────────────────┘  │ │
│  │  └────────────────────┘  │  │                              │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                              [Delete Group] │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

#### Back link

`<- Back to Access` — a `<Link href="/access">` with an inline left-arrow SVG. Classes: `text-sm text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1 mb-4`. The arrow is `w-4 h-4`.

#### Group name heading

`text-xl font-semibold text-zinc-100`. Editable inline: clicking the name converts it to an input field (same `bg-zinc-950 border border-zinc-700 rounded-lg` input style). Pressing Enter or blurring saves. Pressing Escape reverts.

#### Summary line

`text-sm text-zinc-500 mt-1` — auto-generated from current member/agent/environment counts.

#### Members section

Container: `bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden`

Header row: `px-4 py-3 flex items-center justify-between bg-zinc-800/60`
- Left: `text-xs font-semibold text-zinc-500 uppercase tracking-wider` — "Members"
- Right: "+" button (`w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 flex items-center justify-center cursor-pointer text-sm`) that opens an "Add Member" popover (see Section 4e).

Each member row: `px-4 py-3 flex items-center gap-3 border-t border-zinc-800 hover:bg-zinc-800/50`
- Avatar: `w-6 h-6 rounded-full`
- Username: `font-mono text-sm text-zinc-100 flex-1`
- Role badge: same admin/member badge from Section 3b (read-only here — role is set on the user, not per-group)
- Remove button: `text-zinc-600 hover:text-red-400 transition-colors cursor-pointer` — X icon (`w-4 h-4`). Uses the confirm pattern: first click changes to "Remove?", second click executes.

#### Agent Access and Environment Access panels

Laid out side by side using `grid grid-cols-2 gap-4 mt-6` (stacks to `grid-cols-1` on small screens).

Each panel: `bg-zinc-900 border border-zinc-800 rounded-xl`

Panel header: `px-4 py-3 bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase tracking-wider`

Checkbox list: `px-4 py-2`

Each checkbox row: `flex items-center gap-2.5 py-2`
- Checkbox: `w-4 h-4 rounded bg-zinc-950 border border-zinc-700 accent-indigo-600 cursor-pointer`
- Label: `text-sm text-zinc-300`

**"Grant all" toggle:** A separate checkbox at the bottom of each panel, visually separated by `border-t border-zinc-800 mt-2 pt-2`.
- Checking "Grant all" checks all individual checkboxes and disables them (they become `opacity-60 cursor-not-allowed`).
- Unchecking "Grant all" re-enables individual checkboxes and preserves whatever was checked before "Grant all" was toggled on (stored in local state).
- Label: `text-sm text-zinc-400 font-medium`

All checkbox changes save immediately (optimistic, with revert on error). No explicit "Save" button.

#### Delete Group

`mt-6 flex justify-end`

Button: `text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-lg px-4 py-2 text-sm cursor-pointer transition-colors`

Follows the standard confirm-then-execute pattern. On confirm: "Deleting..." with spinner, `disabled:opacity-60 disabled:cursor-not-allowed`. On success: redirect to `/access` with Groups tab active.

---

## 4. Modals and Popovers

### 4a. General modal pattern

All new modals follow the existing React Portal pattern: `fixed inset-0 bg-black/50 flex items-center justify-center z-50`. Modal card: `bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-6`. Close via X button or clicking the backdrop (blocked during in-flight mutations per ADR-006).

### 4b. "No Access" tooltip

Not a modal — a native `title` attribute tooltip used on disabled buttons throughout the kanban board and card detail views.

Format: `"No access — agent '{role}' is not in your groups"` or `"No access — environment '{name}' is not in your groups"`.

If the platform later adopts a custom tooltip component, these `title` attributes can be upgraded. For now, native tooltips avoid adding a new dependency.

### 4c. Invite User modal

```
┌───────────────────────────────────────┐
│  Invite User                    [X]   │
│ ───────────────────────────────────── │
│                                       │
│  GITHUB USERNAME                      │
│  ┌─────────────────────────────────┐  │
│  │ @                               │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ROLE                                 │
│  ┌─────────────────────────────────┐  │
│  │ Member                       v  │  │
│  └─────────────────────────────────┘  │
│                                       │
│  GROUPS (optional)                    │
│  [ ] platform-eng                     │
│  [ ] infra-ops                        │
│  [ ] ci-agents                        │
│                                       │
│  ┌─────────┐  ┌───────────────────┐   │
│  │ Cancel  │  │   Invite User     │   │
│  └─────────┘  └───────────────────┘   │
│                                       │
└───────────────────────────────────────┘
```

**Username input:** `bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 w-full font-mono`. The `@` prefix is a `text-zinc-500` span inside the input wrapper (use a `flex items-center` container with the `@` as a static label and the input taking `flex-1`).

**Role select:** Same select style as the user detail drawer role selector.

**Groups checkboxes:** Same checkbox style as described in Section 3d.

**Cancel button:** `bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer`

**Invite User button:** Primary indigo. Loading state per ADR-006: `disabled:opacity-60 disabled:cursor-not-allowed`, label changes to "Inviting...".

**Validation:**
- Username is required. If empty on submit, the input border changes to `border-red-500` with `text-xs text-red-400 mt-1` below: "GitHub username is required."
- If the username already exists in the system, the API returns an error and the form shows: "This user has already been invited."

### 4d. Create Group modal

```
┌───────────────────────────────────────┐
│  Create Group                   [X]   │
│ ───────────────────────────────────── │
│                                       │
│  GROUP NAME                           │
│  ┌─────────────────────────────────┐  │
│  │                                 │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─────────┐  ┌───────────────────┐   │
│  │ Cancel  │  │   Create Group    │   │
│  └─────────┘  └───────────────────┘   │
│                                       │
└───────────────────────────────────────┘
```

Minimal — just a name. Agent access, environment access, and members are configured on the Group Detail page after creation. This keeps the creation flow fast and avoids a bloated modal.

**Group Name input:** Same input style as above. Required. Error on empty: "Group name is required." Error on duplicate: "A group with this name already exists."

**Create Group button:** Primary indigo with ADR-006 loading states.

On success: redirect to the newly created group's detail page (`/access/groups/[newId]`).

### 4e. Add Member popover

Triggered by the "+" button in the Members section of the Group Detail page. A small popover anchored to the button, not a full modal.

```
┌──────────────────────────────┐
│  [Search users... ________]  │
│  ─────────────────────────── │
│  @alice                      │
│  @bob                        │
│  @carol                      │
└──────────────────────────────┘
```

Container: `absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 py-1`

Search input: `px-3 py-2 bg-transparent border-b border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 w-full focus:outline-none`

Each user option: `px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer flex items-center gap-2`
- Avatar: `w-5 h-5 rounded-full`
- Username: `font-mono text-sm`

Clicking a user adds them to the group immediately (optimistic update). The user disappears from the popover list since they are now a member. If the user is already in the group, they are not shown in the list.

Close on outside click (same pattern as `UserMenu` dropdown).

---

## 5. Kanban Board Access Indicators

### 5a. Restricted card appearance

When the current user does not have access to a card's assigned agent or its target environment, the card is rendered in a visually muted state.

**Muted card classes (additions to the base `KanbanCard`):**

```
opacity-50 cursor-default pointer-events-auto
```

The card loses its hover elevation (`hover:border-zinc-500 hover:bg-zinc-700 hover:shadow-md` are removed). The border stays `border-zinc-700` (no change on hover). The card is clickable (to view details in read-only mode) but is not draggable.

**Drag suppression:** The `useSortable` hook for restricted cards receives `disabled: true`, which prevents dnd-kit from initiating a drag. The card does not get `listeners` or `attributes` from the hook.

**Visual indicator on the card:** A small lock icon (`w-3.5 h-3.5 text-zinc-600`) renders in the top-right corner of the card, absolutely positioned: `absolute top-2 right-2`.

```
┌──────────────────────────────┐
│  Fix login redirect    [lock]│  <- lock icon, top right
│                              │
│  [idle]                      │  <- status badge, also muted
│                              │
│  @agent-svc         2h ago   │
└──────────────────────────────┘
```

The lock icon is the only new visual element. The opacity reduction handles the rest of the visual distinction.

### 5b. Restricted card detail modal

Clicking a restricted card opens the `CardDetailModal` in read-only mode:

- All form fields are disabled (inputs become `opacity-60 cursor-not-allowed`).
- Action buttons (Approve, Request Revision, Move, Retry) are replaced by disabled versions with tooltips explaining the restriction.
- A banner appears at the top of the modal content:

```
┌──────────────────────────────────────────────────┐
│  [lock icon]  You don't have access to modify    │
│               this card.                         │
└──────────────────────────────────────────────────┘
```

Banner classes: `bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 flex items-center gap-2.5 text-sm text-zinc-400 mb-4`

Lock icon: `w-4 h-4 text-zinc-500`

### 5c. Column-level drag targets

When a user drags a card they do have access to, the kanban board highlights valid target columns normally. Columns whose environment or agent restrictions would prevent the move are dimmed:

- Column header opacity drops to `opacity-40`.
- Drop zone does not accept the drag (dnd-kit `isDisabled` on the droppable).
- A `title` tooltip on the column header reads: "This column's environment is not in your access groups."

### 5d. Disabled action buttons

Buttons in the card detail modal and attention queue that the user cannot perform:

Classes: `opacity-40 cursor-not-allowed pointer-events-none`

Each carries a `title` attribute with the specific reason (e.g., "No access to agent backend-engineer").

The button text and styling are otherwise unchanged — only the opacity and cursor signal the restriction.

---

## 6. State Management (Zustand Additions)

The existing `useKobaniStore` gains the following state and actions:

```typescript
// New state
currentUserRole: 'admin' | 'member';
currentUserGroups: string[];            // group IDs the user belongs to
accessibleAgentRoles: Set<string>;      // agent roles the user can interact with
accessibleEnvironmentIds: Set<string>;  // environment IDs the user can interact with

// Computed helper (not in store — a standalone selector function)
canInteractWithCard(card: Card): boolean;
// Returns true if card.role is in accessibleAgentRoles
// AND the card's target environment is in accessibleEnvironmentIds

// Admin page state (only loaded when visiting /access)
accessUsers: AccessUser[];
accessGroups: AccessGroup[];

// Admin page actions
fetchAccessUsers: () => Promise<void>;
fetchAccessGroups: () => Promise<void>;
inviteUser: (username: string, role: 'admin' | 'member', groupIds: string[]) => Promise<void>;
removeUser: (userId: string) => Promise<void>;
updateUserRole: (userId: string, role: 'admin' | 'member') => Promise<void>;
updateUserGroups: (userId: string, groupIds: string[]) => Promise<void>;
createGroup: (name: string) => Promise<string>;  // returns group ID
deleteGroup: (groupId: string) => Promise<void>;
updateGroupAgents: (groupId: string, agentRoles: string[]) => Promise<void>;
updateGroupEnvironments: (groupId: string, envIds: string[]) => Promise<void>;
addGroupMember: (groupId: string, userId: string) => Promise<void>;
removeGroupMember: (groupId: string, userId: string) => Promise<void>;
```

**Access data hydration:** When the app shell mounts (in the root layout or AuthProvider), a single API call fetches the current user's role, groups, and derived access sets. This populates `currentUserRole`, `currentUserGroups`, `accessibleAgentRoles`, and `accessibleEnvironmentIds`. No per-card permission checks happen at render time — the access sets are pre-computed server-side and cached client-side.

**Admin data is lazy-loaded:** `accessUsers` and `accessGroups` are empty arrays until `fetchAccessUsers` / `fetchAccessGroups` are called (triggered when the `/access` page mounts). Non-admin users never trigger these fetches.

---

## 7. New API Types

Added to `lib/api-types.ts`:

```typescript
export interface AccessUser {
  id: string;
  githubUsername: string;
  avatarUrl: string;
  role: 'admin' | 'member';
  groupIds: string[];
  groupNames: string[];
  lastActiveAt: string | null;  // ISO 8601
}

export interface AccessGroup {
  id: string;
  name: string;
  memberCount: number;
  agentRoles: string[];          // empty array = no access; special value ['*'] = all
  environmentIds: string[];      // empty array = no access; special value ['*'] = all
}

export interface AccessGroupDetail extends AccessGroup {
  members: {
    id: string;
    githubUsername: string;
    avatarUrl: string;
    role: 'admin' | 'member';
  }[];
}

export interface CurrentUserAccess {
  role: 'admin' | 'member';
  groupIds: string[];
  agentRoles: string[];          // resolved: all roles the user can access
  environmentIds: string[];      // resolved: all env IDs the user can access
}
```

---

## 8. Component Inventory

### New components

| Component | Path | Description |
|---|---|---|
| `AccessPage` | `app/access/page.tsx` | Next.js page. Admin-only. Renders tab bar, Users tab, and Groups tab. Checks `session.user.role` and redirects non-admins to `/`. |
| `AccessTabBar` | `app/access/_components/AccessTabBar.tsx` | Client component. Two-tab bar with local state. |
| `UsersTable` | `app/access/_components/UsersTable.tsx` | Client component. Renders the users list with search, invite button, and row click handler. |
| `GroupsTable` | `app/access/_components/GroupsTable.tsx` | Client component. Renders the groups list with search and create button. |
| `UserDetailDrawer` | `app/access/_components/UserDetailDrawer.tsx` | Client component. Right-side drawer with role selector, group checkboxes, remove action. |
| `GroupDetailPage` | `app/access/groups/[id]/page.tsx` | Next.js page. Full group config: members, agent access, environment access. |
| `GroupMembersSection` | `app/access/groups/[id]/_components/GroupMembersSection.tsx` | Client component. Member list with add/remove. |
| `GroupAccessPanel` | `app/access/groups/[id]/_components/GroupAccessPanel.tsx` | Client component. Reusable checkbox panel for agent roles or environment IDs. Used twice on the page. |
| `AddMemberPopover` | `app/access/groups/[id]/_components/AddMemberPopover.tsx` | Client component. Search + click to add. |
| `InviteUserModal` | `app/access/_components/InviteUserModal.tsx` | Client component. Modal form for inviting a new user. |
| `CreateGroupModal` | `app/access/_components/CreateGroupModal.tsx` | Client component. Modal form for creating a new group. |
| `RestrictedCardBanner` | `app/boards/[id]/_components/RestrictedCardBanner.tsx` | Client component. Read-only banner shown in CardDetailModal for restricted cards. |

### Modified components

| Component | Change |
|---|---|
| `app/_components/TopNav.tsx` | Add "Access" nav link, conditionally rendered for admins. |
| `app/_components/UserMenu.tsx` | Add admin badge next to username in dropdown. |
| `app/boards/[id]/_components/KanbanCard.tsx` | Accept `restricted` prop. When true: disable sortable, reduce opacity, add lock icon, remove hover elevation. |
| `app/boards/[id]/_components/KanbanBoard.tsx` | Pass `restricted` prop to cards based on `canInteractWithCard` check. |
| `app/boards/[id]/_components/Column.tsx` | Disable droppable for columns with inaccessible environments when a drag is active. |
| `app/boards/[id]/_components/CardDetailModal.tsx` | When card is restricted: show `RestrictedCardBanner`, disable all action buttons, disable form fields. |
| `lib/store.ts` | Add RBAC state, actions, and access selectors. |
| `lib/api-types.ts` | Add `AccessUser`, `AccessGroup`, `AccessGroupDetail`, `CurrentUserAccess` types. |

### New routes

| Route | Type | Purpose |
|---|---|---|
| `app/access/page.tsx` | Next.js page | Admin management (Users + Groups tabs) |
| `app/access/groups/[id]/page.tsx` | Next.js page | Group detail/edit |
| `app/api/access/users/route.ts` | API route | GET: list users. POST: invite user. |
| `app/api/access/users/[id]/route.ts` | API route | PATCH: update role/groups. DELETE: remove user. |
| `app/api/access/groups/route.ts` | API route | GET: list groups. POST: create group. |
| `app/api/access/groups/[id]/route.ts` | API route | GET: group detail. PATCH: update access. DELETE: delete group. |
| `app/api/access/groups/[id]/members/route.ts` | API route | POST: add member. DELETE: remove member. |
| `app/api/access/me/route.ts` | API route | GET: current user's resolved access (role, groups, agent roles, env IDs). |

---

## 9. Empty States

### Users table — no users

Should not occur in practice (the current admin is always present). If it somehow happens:

```
┌────────────────────────────────────────────────┐
│  No users found.                               │
│  Invite your first user to get started.        │
│                                                │
│             [Invite User]                      │
└────────────────────────────────────────────────┘
```

Container: `flex flex-col items-center justify-center py-16`
Primary text: `text-sm text-zinc-600`
Secondary text: `text-xs text-zinc-700 mt-1`
Button: primary indigo, `mt-4`

### Groups table — no groups

```
┌────────────────────────────────────────────────┐
│  No groups yet.                                │
│  Create a group to manage agent and            │
│  environment access.                           │
│                                                │
│             [Create Group]                     │
└────────────────────────────────────────────────┘
```

Same layout pattern as above.

### Group detail — no members

```
┌────────────────────────────────────────────────┐
│  MEMBERS                                  [+]  │
│ ────────────────────────────────────────────── │
│                                                │
│  No members in this group.                     │
│  Click + to add users.                         │
│                                                │
└────────────────────────────────────────────────┘
```

Text: `text-sm text-zinc-600 px-4 py-8 text-center`

### Group detail — no agent/environment access configured

The checkbox panels show all available agents/environments, all unchecked. A subtle note below the checkboxes:

`text-xs text-zinc-600 mt-2 italic` — "No access granted. Members of this group cannot interact with any agents." (or "...any environments.")

### Search — no results

Both user and group search: replace the table body with a single centered message:

`text-sm text-zinc-600 py-8 text-center` — "No results for '{query}'."

---

## 10. Error States

### API failure on admin pages

When `fetchAccessUsers`, `fetchAccessGroups`, or any mutation fails, display an inline error bar above the affected table or section:

`bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300 mb-4`

Text: "Failed to load users. Please try again." with a "Retry" link (`text-red-400 hover:text-red-300 underline cursor-pointer ml-2`).

This follows the same error bar pattern established in the auth DESIGN.md (`AuthErrorBar`).

### Mutation failure (role change, group update, member add/remove)

Optimistic updates revert on failure. A brief inline error appears next to the affected element:

- Role select: `text-xs text-red-400 mt-1` — "Failed to update role."
- Group checkbox: the checkbox visually reverts and a `text-xs text-red-400` label appears to the right — "Failed."
- Member remove: reverts the removal, row reappears, with a brief red flash (`animate-pulse` for 1 second).

### Non-admin visits `/access` directly

The `/access` page checks the user's role server-side. Non-admins receive a redirect to `/` (the board list). No error page is shown — the route simply does not serve content to non-admins.

If the middleware is bypassed somehow (edge case), the client-side check in `AccessPage` also verifies the role and renders a fallback:

`text-sm text-zinc-500 py-16 text-center` — "You do not have access to this page."

---

## 11. Responsive Considerations

### Admin pages (Users, Groups, Group Detail)

| Breakpoint | Behavior |
|---|---|
| `>= lg` (1024px) | Full layout as described in wireframes. Two-column grid for agent/environment panels. |
| `md - lg` (768-1024px) | Tables gain horizontal scroll (`overflow-x-auto`). Agent/environment panels stack to single column (`grid-cols-1`). |
| `< md` (< 768px) | Users table hides "Last Active" column (`hidden md:table-cell`). Groups table hides "Environments" column (`hidden md:table-cell`). User detail drawer goes full-width (`w-full` instead of `w-96`). |
| `< sm` (< 640px) | Users table hides "Groups" column as well (`hidden sm:table-cell`). Search input goes full-width. Buttons stack vertically. |

### Kanban board access indicators

No responsive changes needed. The lock icon, opacity reduction, and disabled states work at all viewport sizes. The tooltips are native `title` attributes which render on hover (desktop) — on mobile, the restriction is communicated solely through the opacity and lock icon.

### TopNav "Access" link

On very narrow viewports where the nav links overflow, the "Access" link follows the same truncation behavior as existing links (the `shrink-0` class prevents text wrapping; the nav scrolls if needed via the existing `min-w-0` on the left container and `overflow-hidden` implicit in the fixed nav height).

---

## 12. Accessibility

- All interactive elements are native `<button>` or `<a>` elements with proper roles.
- Checkbox inputs use native `<input type="checkbox">` for built-in keyboard and screen reader support.
- The user detail drawer traps focus when open (Tab cycles within the drawer) and returns focus to the triggering row when closed.
- The admin badge uses `aria-label="Administrator"` for screen readers.
- Lock icons on restricted cards use `aria-label="You do not have access to this card"`.
- Disabled action buttons retain their text labels (no icon-only disabled states) so screen readers can announce both the action and the disabled state.
- Color is never the sole indicator of access level — the lock icon and opacity change together provide redundant signals.

---

## 13. Copy

### Access page

| Element | Text |
|---|---|
| Page `<title>` | `Access Control — Kobani` |
| Heading | `Access Control` |
| Subheading | `Manage users, groups, and permissions.` |
| Users tab | `Users` |
| Groups tab | `Groups` |

### Users table

| Element | Text |
|---|---|
| Search placeholder | `Search users...` |
| Invite button | `Invite User` |
| Invite button (loading) | `Inviting...` |
| Empty state | `No users found.` / `Invite your first user to get started.` |
| No results | `No results for '{query}'.` |

### Groups table

| Element | Text |
|---|---|
| Search placeholder | `Search groups...` |
| Create button | `Create Group` |
| Create button (loading) | `Creating...` |
| Empty state | `No groups yet.` / `Create a group to manage agent and environment access.` |

### Group detail page

| Element | Text |
|---|---|
| Back link | `Back to Access` |
| Members header | `Members` |
| Agent access header | `Agent Access` |
| Environment access header | `Environment Access` |
| Grant all label | `Grant all` |
| No members | `No members in this group. Click + to add users.` |
| No agent access | `No access granted. Members of this group cannot interact with any agents.` |
| No environment access | `No access granted. Members of this group cannot interact with any environments.` |
| Delete button | `Delete Group` |
| Delete confirm | `Delete this group? This cannot be undone.` |
| Delete loading | `Deleting...` |

### Kanban board

| Element | Text |
|---|---|
| Restricted card tooltip | `No access — agent '{role}' is not in your groups` |
| Restricted env tooltip | `No access — environment '{name}' is not in your groups` |
| Restricted card banner | `You don't have access to modify this card.` |
| Disabled column tooltip | `This column's environment is not in your access groups.` |

### Invite User modal

| Element | Text |
|---|---|
| Title | `Invite User` |
| Username label | `GitHub Username` |
| Username placeholder | `username` |
| Role label | `Role` |
| Groups label | `Groups (optional)` |
| Cancel | `Cancel` |
| Submit | `Invite User` |
| Submit loading | `Inviting...` |
| Validation: empty username | `GitHub username is required.` |
| Validation: duplicate | `This user has already been invited.` |

### Create Group modal

| Element | Text |
|---|---|
| Title | `Create Group` |
| Name label | `Group Name` |
| Name placeholder | `e.g. platform-eng` |
| Cancel | `Cancel` |
| Submit | `Create Group` |
| Submit loading | `Creating...` |
| Validation: empty name | `Group name is required.` |
| Validation: duplicate | `A group with this name already exists.` |

---

*Design by: Kobani UX*
*Last updated: 2026-04-14*
