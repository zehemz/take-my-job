# Claude Code — Project Instructions

## Doc structure

All documentation lives under `docs/`. Follow this structure exactly:

```
docs/
├── INDEX.md                        ← update this whenever a feature is added or its status changes
├── definitions/glossary.md         ← add new domain terms here
├── architecture/
│   ├── overview.md
│   └── decisions/ADR-NNN-*.md     ← one file per architectural decision
└── features/<feature-name>/
    ├── PRD.md
    ├── DESIGN.md
    ├── TECH_SPEC.md
    └── SECURITY_REVIEW.md          ← only when relevant
```

### Rules

- **New feature?** Create `docs/features/<feature-name>/` and add a row to `docs/INDEX.md` with status `🟡 Planned`.
- **Architectural decision made?** Write an ADR in `docs/architecture/decisions/` using the next available number. ADRs capture the *why*, not just the *what*.
- **New domain term?** Add it to `docs/definitions/glossary.md`.
- **Feature status changed?** Update `docs/INDEX.md` first, then the relevant spec.
- **Never** put spec content directly in `INDEX.md` — it is an index only.
- **Never** create docs outside `docs/` (except `CLAUDE.md` and `README.md` at root).

### Status legend for INDEX.md

✅ Shipped · 🔵 In Design · 🟠 In Progress · 🟡 Planned · ⛔ Blocked

---

## Tooling

This project uses [mise](https://mise.jdx.dev/) for runtime version management and task running. The configuration lives in `mise.toml` at the project root.

- **Runtime versions:** Node is pinned via mise (`node = "22"`). Do not use `nvm`, `.nvmrc`, or `.node-version` — mise is the single source of truth for tool versions.
- **Environment:** mise loads `.env` automatically (`_.file = ".env"`). Do not add `dotenv` or similar packages.
- **Task runner:** Use `mise run <task>` for common operations instead of calling `npm run` directly:
  | Task | Command | Description |
  |------|---------|-------------|
  | `dev` | `mise run dev` | Start Next.js dev server |
  | `e2e` | `mise run e2e` | Run Playwright E2E tests (headless) |
  | `e2e:ui` | `mise run e2e:ui` | Run Playwright E2E tests (interactive) |
  | `e2e:report` | `mise run e2e:report` | Open last Playwright HTML report |
  | `db` | `mise run db` | Open Prisma Studio |
  | `db:migrate` | `mise run db:migrate` | Run pending DB migrations |

If you need to add a new recurring dev task, add it to `mise.toml` under `[tasks]` rather than creating a standalone script.

---

## Development process

- **Spec before code.** Before implementing any feature, check `docs/features/` for an existing PRD or TECH_SPEC. If none exists, create the spec first (or ask). Never implement reactively without a spec.
- **E2E scenarios are mandatory.** Every new feature must include E2E scenarios added to `docs/features/e2e-testing/SCENARIOS.md`. This is part of the definition of done, not optional.
- **Always use git worktrees.** Never commit directly to `main` and never use `git checkout -b` in the main working directory — switching branches there causes commits to land on the wrong branch when the team has other work in flight. Instead:
  ```bash
  # Start every task with a new worktree
  git worktree add ../take-my-job--<type>-<description> -b <type>/<description>
  # Work entirely inside that directory, then push + open a PR
  gh pr create ...
  # Clean up after merge
  git worktree remove ../take-my-job--<type>-<description>
  ```
  The main worktree stays on `main` at all times. Each feature/fix lives in its own isolated directory with no branch ambiguity.

---

## Code conventions

- API contract types go in `lib/api-types.ts` — never inline response shapes in route files.
- DB→API mapping logic goes in `lib/api-mappers.ts`.
- Every API route handler must call `auth()` as a secondary guard (once auth is implemented).
- `approvedBy` and any user-attribution fields must always be set server-side from the session, never from the request body.
- **Every mutation button must have a loading state** (see ADR-006). Use `disabled={loading}`, change the label to an ellipsis form (`'Saving…'`), block modal dismissal while in-flight, and always clear loading in `finally`. Classes: `disabled:opacity-60 disabled:cursor-not-allowed`.

---

## Agent teams

When running multi-agent work (designer, PM, engineer, security), each agent writes to its own file. After all agents finish, consolidate findings and commit everything together in one structured commit.
