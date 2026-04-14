# E2E Tests — Kobani

Playwright + Chromium. Tests run against your local dev server (no embedded server).

---

## Quick start

```bash
# Terminal 1 — start the dev server
npm run dev

# Terminal 2 — run tests
npm run e2e          # headless
npm run e2e:ui       # interactive Playwright UI (great for debugging)
npm run e2e:report   # open last HTML report
```

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| `npm run dev` running on port 3000 | Tests fail fast if server is unreachable |
| `.env.local` with `AUTH_SECRET` | Used to sign fake session cookies |
| `TEST_GITHUB_USERNAME` in `.env.local` | Username injected into test sessions (default: `testuser`) |
| This username in `ALLOWED_GITHUB_USERS` | Only needed if you're testing sign-in flow end-to-end |
| A seeded database | Some board/card tests skip gracefully if DB is empty |

Seed the DB:
```bash
npm run db:seed     # if a seed script exists
# or: npx prisma db seed
```

---

## Directory structure

```
e2e/
  fixtures.ts          — Playwright custom fixtures (authedPage, cookieHeader)
  global-setup.ts      — Runs before all tests; verifies dev server is up
  helpers/
    api.ts             — Typed KobaniApi client for direct API calls in tests
  auth.spec.ts         — Auth flows (E2E-AUTH-*)
  board.spec.ts        — Board list + nav (E2E-BOARD-*)
  card.spec.ts         — Card CRUD + move (E2E-CARD-*)
  README.md            — This file
```

Test scenario catalog (all IDs, planned and implemented):
→ `docs/features/e2e-testing/SCENARIOS.md`

---

## How auth works in tests

GitHub OAuth can't be automated directly. Instead, tests inject a valid NextAuth v5
session cookie signed with `AUTH_SECRET` using `@auth/core/jwt`'s own `encode` function
(the same one NextAuth uses internally). This guarantees the cookie format is always correct.

The `authedPage` fixture handles this automatically — just import `test` from `./fixtures`:

```ts
import { test, expect } from './fixtures';

test('my test', async ({ authedPage }) => {
  await authedPage.goto('/');
  // page is fully authenticated
});
```

For direct API calls, use the `cookieHeader` fixture + `KobaniApi`:

```ts
import { test, expect } from './fixtures';
import { KobaniApi } from './helpers/api';

test('api test', async ({ cookieHeader, request }) => {
  const api = new KobaniApi(request, cookieHeader);
  const boards = await api.getBoards();
  expect(boards.length).toBeGreaterThan(0);
});
```

---

## Adding a new test

1. Check `docs/features/e2e-testing/SCENARIOS.md` — find the scenario or add a new planned row.
2. Write the test in the relevant `e2e/*.spec.ts` file (or create a new one for a new feature area).
3. Use `data-testid` attributes to target elements — **never** use text content or CSS class selectors.
4. Mark the scenario as `✅ Implemented` in SCENARIOS.md once it passes.

### data-testid reference

| Selector | Element |
|----------|---------|
| `[data-testid="board-list"]` | Grid container on the home page |
| `[data-testid="board-card"]` | Individual board card link |
| `[data-testid="column"]` | Kanban column (also has `data-column-id`) |
| `[data-testid="column-name"]` | Column name text |
| `[data-testid="add-card-button"]` | "+ Add card" button inside a column |
| `[data-testid="kanban-card"]` | Individual card (also has `data-card-id`) |
| `[data-testid="kanban-card-title"]` | Card title text |
| `[data-testid="new-card-modal"]` | New card modal dialog |
| `[data-testid="new-card-title-input"]` | Title input in new card modal |
| `[data-testid="new-card-submit"]` | "Create Card" submit button |
| `[data-testid="user-menu-trigger"]` | Avatar button that opens the user menu |
| `[data-testid="user-menu-dropdown"]` | Dropdown panel |
| `[data-testid="user-menu-username"]` | `@username` text in dropdown |
| `[data-testid="sign-out-button"]` | Sign out button in dropdown |

When adding a new feature, add `data-testid` to its key interactive elements before writing tests.

---

## CI

Tests run in GitHub Actions on every PR. See `.github/workflows/e2e.yml` (to be created).
The `PLAYWRIGHT_BASE_URL`, `AUTH_SECRET`, and `TEST_GITHUB_USERNAME` must be set as
repository secrets / environment variables.
