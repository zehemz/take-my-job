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

## Development process

- **Spec before code.** Before implementing any feature, check `docs/features/` for an existing PRD or TECH_SPEC. If none exists, create the spec first (or ask). Never implement reactively without a spec.
- **E2E scenarios are mandatory.** Every new feature must include E2E scenarios added to `docs/features/e2e-testing/SCENARIOS.md`. This is part of the definition of done, not optional.

---

## Code conventions

- API contract types go in `lib/api-types.ts` — never inline response shapes in route files.
- DB→API mapping logic goes in `lib/api-mappers.ts`.
- Every API route handler must call `auth()` as a secondary guard (once auth is implemented).
- `approvedBy` and any user-attribution fields must always be set server-side from the session, never from the request body.

---

## Agent teams

When running multi-agent work (designer, PM, engineer, security), each agent writes to its own file. After all agents finish, consolidate findings and commit everything together in one structured commit.
