# Design Spec — Agent Management (v1: List)

## 1. Layout

### Page shell

```
┌──────────────────────────────────────────────────────────┐
│  TopNav (h-12, bg-zinc-900, border-b border-zinc-800)    │
├──────────────────────────────────────────────────────────┤
│  px-8 py-8                                               │
│  ┌───────────────────────────────────────────────────┐   │
│  │ h1  "Agents"              text-xl font-semibold   │   │
│  │ p   "3 agents"            text-sm text-zinc-500   │   │
│  └───────────────────────────────────────────────────┘   │
│  mb-6                                                    │
│  ┌───────────────────────────────────────────────────┐   │
│  │ AgentConfigTable (full width)                     │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

- Outer wrapper: `flex flex-col min-h-screen` — same as `BoardListClient` and `AttentionQueueClient`.
- Content area: `flex-1 px-8 py-8` — matches the board list page.
- No max-width constraint on the table; it fills the content area. The table itself is `w-full`.
- No action button in the heading row (read-only v1).

### Nav link — "Agents"

Add a plain `<Link>` to `TopNav` between the brand wordmark section and the right-side icons:

```tsx
<Link
  href="/agents"
  className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
>
  Agents
</Link>
```

Place it inside the left flex group (`flex items-center flex-1 gap-0.5`), after any breadcrumb content, before the right-side `<div>` — or add a centre zone. Keep it `shrink-0`.

Active state: when `pathname === '/agents'`, use `text-zinc-100` instead of `text-zinc-400`. Use Next.js `usePathname` for this.

---

## 2. Agent Table

### Container

```
bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden
```

### `<table>` structure

```
w-full text-sm border-collapse
```

#### `<thead>`

```
bg-zinc-800/60
```

Header cells: `px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider`

#### `<tbody>` rows

Alternating background: odd rows `bg-transparent`, even rows `bg-zinc-800/20`. Divider between rows: `border-t border-zinc-800`.

Row cells: `px-4 py-3 align-middle`

### Column definitions

| # | Header | Data field | Priority | Width hint |
|---|--------|------------|----------|------------|
| 1 | Role | `role` | Always | `w-40` |
| 2 | Agent ID | `anthropicAgentId` | Always | `min-w-[200px]` |
| 3 | Version | `anthropicAgentVersion` | Always | `w-20` |
| 4 | Environment ID | `anthropicEnvironmentId` | Hide ≤ md | `min-w-[200px]` |
| 5 | Created | `createdAt` | Hide ≤ sm | `w-36` |

### Cell visual treatment

#### Role badge (column 1)

Render as an inline pill, same anatomy as `AgentStatusBadge` (border-l-4, rounded-md, px-2 py-0.5, text-xs font-semibold), but with a fixed neutral palette since roles are not status-driven:

```
bg-zinc-700 text-zinc-200 border-l-zinc-500
```

Display the human-readable label (e.g. "Backend Engineer", "QA Engineer", "Tech Lead") mapped from the `role` key via `ROLE_LABELS` in `lib/agent-roles.ts`. Fall back to the raw `role` string if not found.

#### Agent ID / Environment ID (columns 2 & 4)

Two sub-elements side by side (`flex items-center gap-2`):

1. **Truncated monospace string:**
   `font-mono text-xs text-zinc-300 truncate max-w-[160px]`
   Show the full value in a native `title` attribute for hover.

2. **Copy icon button** — see §4 for full spec.

#### Version (column 3)

Plain text: `font-mono text-xs text-zinc-400`

#### Created (column 5)

Format: `toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })`
e.g. `Apr 9, 2025`
Classes: `text-xs text-zinc-500`

---

## 3. Empty State

When `agents.length === 0`, replace the `<tbody>` content with a single full-width row:

```tsx
<tr>
  <td colSpan={5} className="px-4 py-16 text-center">
    <p className="text-sm text-zinc-600">No agents configured.</p>
    <p className="text-xs text-zinc-700 mt-1">
      Run <code className="font-mono">scripts/setup-agents.ts</code> to provision.
    </p>
  </td>
</tr>
```

`<code>` classes: `bg-zinc-800 px-1 rounded text-zinc-500`

Do not render the `<thead>` when the table is empty — hide it with a conditional so the empty state takes the full visual focus.

---

## 4. Copy Interaction

### Anatomy

```
┌──────────────────┐  ┌──────────────────────────┐
│  ant_ag_xyz…     │  │ [copy icon] / [Copied!]  │
└──────────────────┘  └──────────────────────────┘
```

### Copy button spec

- Element: `<button type="button">`
- Default state icon: clipboard SVG (`w-3.5 h-3.5`), `text-zinc-500 hover:text-zinc-300`
- Pressed/success state: replace icon with the text `Copied!` in `text-xs text-emerald-400`
- Transition: success state lasts **1500 ms**, then reverts to default
- Classes (button wrapper): `inline-flex items-center gap-1 transition-colors cursor-pointer`
- `aria-label="Copy to clipboard"` (default) / `aria-label="Copied"` (success)
- On click: `navigator.clipboard.writeText(fullValue)` — write the **full untruncated** value

### State management

Each copyable cell gets its own independent `copied` boolean via `useState`. Two cells on the same row (Agent ID and Environment ID) are independent — copying one does not affect the other.

---

## 5. Responsive Behaviour

| Breakpoint | Visible columns |
|------------|----------------|
| `< sm` (< 640 px) | Role, Agent ID, Version |
| `sm – md` (640–768 px) | Role, Agent ID, Version |
| `≥ md` (≥ 768 px) | All five columns |

Apply with Tailwind responsive modifiers on `<th>` and `<td>`:

- Environment ID: `hidden md:table-cell`
- Created: `hidden sm:table-cell`

On narrow viewports the Agent ID column does not truncate further — it relies on `overflow-x-auto` on the table wrapper:

```tsx
<div className="overflow-x-auto">
  <table className="w-full text-sm border-collapse">…</table>
</div>
```

---

## 6. Design Tokens

### Palette (zinc-based, matching the rest of the app)

| Token | Tailwind class | Usage |
|-------|---------------|-------|
| Page background | `bg-zinc-950` (inherited from layout) | — |
| Nav bar | `bg-zinc-900 border-zinc-800` | TopNav (existing) |
| Table container | `bg-zinc-900 border-zinc-800` | Card/panel surface |
| Table header bg | `bg-zinc-800/60` | Subtle header distinction |
| Alternate row | `bg-zinc-800/20` | Even rows |
| Row divider | `border-zinc-800` | `border-t` |
| Primary text | `text-zinc-100` | Headings |
| Secondary text | `text-zinc-400` | Body / nav link default |
| Muted text | `text-zinc-500` | Subtitles, dates, header labels |
| Faintest text | `text-zinc-600` | Empty state, created date |
| Monospace value | `text-zinc-300` | IDs |
| Role badge bg | `bg-zinc-700 border-l-zinc-500` | Role pill |
| Copy success | `text-emerald-400` | "Copied!" label |
| Accent / CTA | `bg-indigo-600 hover:bg-indigo-500` | Not used in v1 (read-only) |

### Typography

| Element | Classes |
|---------|---------|
| Page h1 | `text-xl font-semibold text-zinc-100` |
| Page subtitle | `text-sm text-zinc-500 mt-1` |
| Table header label | `text-xs font-semibold text-zinc-500 uppercase tracking-wider` |
| Table body cell | `text-sm text-zinc-300` |
| Monospace ID | `font-mono text-xs text-zinc-300` |
| Version | `font-mono text-xs text-zinc-400` |
| Date | `text-xs text-zinc-500` |

### Spacing

- Page padding: `px-8 py-8` (matches board list)
- Heading → table gap: `mb-6`
- Cell padding: `px-4 py-3`
- Copy button gap from truncated text: `gap-2`
