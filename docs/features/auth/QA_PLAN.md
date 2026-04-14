# QA Plan — GitHub OAuth Authentication
**Feature:** GitHub OAuth sign-in with username whitelist  
**Date:** 2026-04-13  
**Scope:** `auth.ts`, `middleware.ts`, `app/login/page.tsx`, `app/unauthorized/page.tsx`, `app/_components/UserMenu.tsx`, `app/api/boards/route.ts`, `app/api/events/[cardId]/route.ts`

---

## Environment Setup

Before running any test in this plan, ensure the following are in place:

| Variable | Required value |
|---|---|
| `ALLOWED_GITHUB_USERS` | Comma-separated list including at least one test account you control, and explicitly NOT including a second test account |
| `AUTH_SECRET` | 64-character hex string from `openssl rand -hex 32` |
| `GITHUB_ID` | Client ID of a registered GitHub OAuth App |
| `GITHUB_SECRET` | Client secret of the same OAuth App |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) or the actual deployment URL |

**Test accounts needed:**  
- **Account A (allowed):** A GitHub account whose login is present in `ALLOWED_GITHUB_USERS`.  
- **Account B (blocked):** A GitHub account whose login is absent from `ALLOWED_GITHUB_USERS`. Must be a real GitHub account so GitHub OAuth completes successfully.

**Browser tooling:** Use browser DevTools → Application → Cookies to inspect session cookies. Use the Network panel to observe redirect chains.

---

## Test Cases

---

### TC-01 — Happy Path: Whitelisted User Signs In

**Category:** Happy path  
**Priority:** P0

**Prerequisites:**
- App is running.
- Account A is in `ALLOWED_GITHUB_USERS`.
- No active session cookie in the browser (use a fresh private window or clear cookies for the origin).

**Steps:**
1. Navigate to `http://localhost:3000/` in a fresh private window.
2. Observe the redirect destination.
3. On the `/login` page, click **Continue with GitHub**.
4. Complete the GitHub OAuth flow in the GitHub-hosted UI using Account A's credentials (authorize if prompted).
5. Observe the URL after the redirect completes.
6. Inspect the navigation bar.
7. Open the user menu by clicking the avatar in the nav.

**Expected result:**
- Step 2: Browser is redirected to `/login?callbackUrl=%2F`. The login page renders with the Kobani logo and the **Continue with GitHub** button.
- Step 4: GitHub OAuth completes without error.
- Step 5: Browser lands on `/` (the board list). URL is `http://localhost:3000/`.
- Step 6: The nav displays the user's avatar (or initials fallback if the avatar fails to load). No GitHub-specific branding is required in the nav beyond the avatar.
- Step 7: The dropdown shows `@<account-a-username>` in monospace text at the top, followed by a **Sign out** button.

**Pass criteria:**
- [ ] `/` is rendered (not `/login`, not `/unauthorized`).
- [ ] `@<username>` in the dropdown exactly matches Account A's GitHub login (case as returned by GitHub).
- [ ] The session cookie (`next-auth.session-token` or `__Secure-next-auth.session-token`) is present in DevTools → Application → Cookies with `HttpOnly` and `SameSite=Lax` flags set.
- [ ] Cookie `Max-Age` is 86400 seconds (24 hours), not the 30-day Auth.js default.

---

### TC-02 — Blocked User: Valid GitHub OAuth but Not Whitelisted

**Category:** Access control  
**Priority:** P0

**Prerequisites:**
- App is running.
- Account B's login is absent from `ALLOWED_GITHUB_USERS`.
- No active session for Account B in the browser.

**Steps:**
1. Navigate to `http://localhost:3000/` in a fresh private window.
2. Click **Continue with GitHub** on the `/login` page.
3. Complete the GitHub OAuth flow using Account B's credentials.
4. Observe the page the browser lands on after the OAuth callback completes.
5. Read the text content of the page carefully — heading, body copy, and any buttons.
6. Check the URL bar.

**Expected result:**
- Browser lands on `/unauthorized`.
- The page heading reads **Access denied**.
- Body copy reads: "Contact your team admin to request access." — no other text is present.
- There is a **Sign in** link that goes to `/login`.
- The page does not mention GitHub, does not display Account B's username, and does not expose any technical detail about why access was denied.
- No session cookie is created.

**Pass criteria:**
- [ ] URL is `/unauthorized`, not `/login?error=AccessDenied` and not any other route.
- [ ] The words "GitHub" and Account B's username do not appear anywhere in the page source.
- [ ] DevTools → Application → Cookies shows no `next-auth.session-token` cookie for the origin.
- [ ] The `/login?callbackUrl=%2F` page is reachable via the **Sign in** link.

**Notes:**  
Auth.js routes `signIn` callback returning `false` to `pages.error`, which is set to `/unauthorized`. Verify this is `/unauthorized` and not `/login?error=AccessDenied` (which is where Auth.js sends `AccessDenied` errors by default when `pages.error` is not set). The custom `pages.error: '/unauthorized'` in `auth.ts` is what controls this.

---

### TC-03 — Unauthenticated API: curl Without Session Cookie

**Category:** API protection  
**Priority:** P0

**Prerequisites:**
- App is running.
- No session cookie.

**Steps:**
1. From a terminal, run:
   ```
   curl -i http://localhost:3000/api/boards
   ```
2. Inspect the HTTP status code and response body.

**Expected result:**
- HTTP status: `401`
- Response body (JSON): `{"error":"Unauthorized"}`
- Response `Content-Type` header: `application/json`

**Pass criteria:**
- [ ] Status is exactly `401` (not `302`, not `403`, not `200`).
- [ ] Body is exactly `{"error":"Unauthorized"}` (confirmed by middleware returning `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` for API paths when `req.auth` is absent).
- [ ] No redirect to `/login` is issued.

**Notes:**  
`curl` does not follow redirects by default. A `302` response here would indicate the middleware is treating the API route as a browser route. The middleware in `middleware.ts` checks `req.nextUrl.pathname.startsWith('/api/')` to branch between JSON 401 and browser redirect — this test validates that branch.

---

### TC-04 — Unauthenticated Browser: Redirect to /login

**Category:** Route protection  
**Priority:** P0

**Prerequisites:**
- App is running.
- No active session (fresh private window or cleared cookies).

**Steps:**
1. Navigate directly to `http://localhost:3000/` in a browser with no session.
2. Observe the URL after navigation settles.
3. Observe the page content.

**Expected result:**
- Browser is redirected to `/login?callbackUrl=%2F`.
- The login page is rendered.

**Pass criteria:**
- [ ] Final URL is `http://localhost:3000/login?callbackUrl=%2F`.
- [ ] The login page renders with the **Continue with GitHub** button.
- [ ] No flash of the board list UI is visible before the redirect.
- [ ] Repeat with `/boards`, `/some-other-route` — each should redirect to `/login?callbackUrl=<encoded-path>`.

**Additional sub-test — Non-root path:**
1. Navigate to `http://localhost:3000/boards` (or any non-public route) without a session.
2. Verify redirect lands at `/login?callbackUrl=%2Fboards`.

---

### TC-05 — callbackUrl Restoration After Sign-In

**Category:** User experience / redirect  
**Priority:** P1

**Prerequisites:**
- App is running.
- Account A is in `ALLOWED_GITHUB_USERS`.
- No active session.

**Steps:**
1. Navigate directly to `http://localhost:3000/boards` (or any specific protected route) without a session.
2. Observe the redirect: should land at `/login?callbackUrl=%2Fboards`.
3. Click **Continue with GitHub** and complete the OAuth flow with Account A.
4. Observe the URL after the callback redirect completes.

**Expected result:**
- After successful sign-in, the browser lands on the originally requested path (`/boards`), not on `/`.

**Pass criteria:**
- [ ] Final URL after OAuth callback is the originally requested protected path.
- [ ] If the originally requested path no longer exists or returns an error, that is a separate concern — the redirect itself must point to the correct path.

**Implementation note:**  
The `callbackUrl` is validated in `app/login/page.tsx` (line 18: `raw.startsWith('/') && !raw.startsWith('//')`) before being passed to `GitHubSignInButton`, which passes it to `signIn('github', { callbackUrl })`. Auth.js also validates the `callbackUrl` at the library level before the final redirect.

---

### TC-06 — Open-Redirect Prevention

**Category:** Security  
**Priority:** P0

**Prerequisites:**
- App is running.

**Sub-test A — Protocol-relative URL:**
1. Navigate to: `http://localhost:3000/login?callbackUrl=//evil.com`
2. Click **Continue with GitHub** and sign in with Account A.
3. Observe the final redirect destination after the OAuth callback.

**Expected result for A:** Browser lands on `/` (the root), not `//evil.com`.

**Sub-test B — Absolute external URL:**
1. Navigate to: `http://localhost:3000/login?callbackUrl=https://evil.com`
2. Click **Continue with GitHub** and sign in with Account A.
3. Observe the final redirect destination.

**Expected result for B:** Browser lands on `/`, not `https://evil.com`.

**Sub-test C — Middleware-generated callbackUrl (no query param attack):**
1. In a terminal: `curl -i http://localhost:3000/` — the `Location` header in the 307/302 response should be `/login?callbackUrl=%2F`.
2. Manually craft: `curl -i 'http://localhost:3000/login?callbackUrl=//evil.com'` — observe the login page renders without auto-redirecting.

**Pass criteria:**
- [ ] Sub-test A: Final URL after OAuth is `http://localhost:3000/` (root), not any external domain.
- [ ] Sub-test B: Final URL after OAuth is `http://localhost:3000/`, not `https://evil.com`.
- [ ] The login page itself does not redirect to external URLs at page-load time.
- [ ] No `Location: //evil.com` header appears anywhere in the redirect chain (inspect DevTools → Network → preserve log).

**Implementation note:**  
Two independent validation layers exist:  
1. `app/login/page.tsx` strips invalid `callbackUrl` before rendering: `raw.startsWith('/') && !raw.startsWith('//')`.  
2. Auth.js validates `redirectTo` before the final post-callback redirect.  
Both layers must be verified. A failure of layer 1 (e.g., the raw value being passed directly to `signIn`) would be caught if Auth.js layer 2 still blocks it — but do not rely on this; verify layer 1 explicitly by inspecting what `callbackUrl` value is present in the button's `href` before clicking.

---

### TC-07 — SSE Endpoint: Unauthenticated Request Returns 401

**Category:** API protection  
**Priority:** P0

**Prerequisites:**
- App is running.
- A valid card ID exists in the database (retrieve one from `GET /api/boards` after signing in, then navigate to a board to get a card ID, or query the DB directly).
- No session cookie for the test request.

**Steps:**
1. From a terminal, run:
   ```
   curl -i -N -H "Accept: text/event-stream" http://localhost:3000/api/events/<valid-card-id>
   ```
2. Inspect the HTTP status code and response body.

**Expected result:**
- HTTP status: `401`
- Response body: `{"error":"Unauthorized"}`
- The SSE stream is not opened (no `text/event-stream` content type, no `: connected` heartbeat line).

**Pass criteria:**
- [ ] Status is exactly `401`.
- [ ] No SSE stream data is returned.
- [ ] The per-route `auth()` check at line 11-12 of `app/api/events/[cardId]/route.ts` fires and returns the 401 before the stream is created.

**Additional sub-test — With valid session:**
1. Extract the session cookie from a signed-in browser session (DevTools → Application → Cookies → copy the `next-auth.session-token` value).
2. Run:
   ```
   curl -i -N -H "Accept: text/event-stream" \
        -H "Cookie: next-auth.session-token=<value>" \
        http://localhost:3000/api/events/<valid-card-id>
   ```
3. Verify the response is `200 text/event-stream` and the first line is `: connected`.

**Pass criteria for sub-test:**
- [ ] Status is `200`.
- [ ] `Content-Type: text/event-stream`.
- [ ] First output line is `: connected`.

---

### TC-08 — Session Expiry: maxAge Is 24 Hours

**Category:** Session security  
**Priority:** P1

**Prerequisites:**
- Account A is signed in.

**Steps (inspection-based — no waiting required):**
1. Open DevTools → Application → Cookies for `http://localhost:3000`.
2. Locate the `next-auth.session-token` cookie (or `__Secure-next-auth.session-token` in production).
3. Read the **Expires / Max-Age** column.

**Expected result:**
- The cookie's `Max-Age` is 86400 seconds (24 hours), matching `session: { maxAge: 24 * 60 * 60 }` in `auth.ts` line 22.
- The cookie's `Expires` date is approximately 24 hours from now.

**Pass criteria:**
- [ ] `Max-Age` is 86400 (not 2592000, which would be the 30-day Auth.js default).
- [ ] Cookie has `HttpOnly` flag set (not readable via `document.cookie`).
- [ ] Cookie has `SameSite=Lax` attribute.

**Expiry behavior test (requires time manipulation or a short-lived token):**  
To test actual expiry behavior without waiting 24 hours, use the browser's DevTools to manually delete the session cookie after recording the value, wait for any in-flight requests to complete, then navigate to a protected route and verify the redirect to `/login` occurs.

---

### TC-09 — Sign-Out: Session Is Cleared

**Category:** Session lifecycle  
**Priority:** P0

**Prerequisites:**
- Account A is signed in and on a protected page (e.g., `/`).

**Steps:**
1. Click the avatar in the nav to open the user menu dropdown.
2. Verify `@<username>` is displayed in the dropdown header.
3. Click **Sign out**.
4. Observe the page navigated to.
5. Attempt to navigate to `http://localhost:3000/`.
6. Observe the destination.

**Expected result:**
- Step 4: Browser is redirected to `/login` (the `signOut({ callbackUrl: '/login' })` call in `UserMenu.tsx` line 63).
- Step 6: Navigation to `/` redirects to `/login?callbackUrl=%2F` (middleware sees no session).

**Pass criteria:**
- [ ] After sign-out, the `next-auth.session-token` cookie is absent from DevTools → Application → Cookies.
- [ ] Navigating to any protected route after sign-out redirects to `/login`.
- [ ] A `curl /api/boards` after sign-out (without the now-deleted cookie) returns `401`.
- [ ] The user menu no longer shows `@<username>` if the page is somehow reached without a session (this is an edge case; the middleware redirect is the primary guard).

---

### TC-10 — Startup Failure: ALLOWED_GITHUB_USERS Unset

**Category:** Misconfiguration safety  
**Priority:** P1

**Prerequisites:**
- A development environment where the `.env` file can be temporarily modified.
- Do NOT run this against a production deployment.

**Steps:**
1. Remove or comment out `ALLOWED_GITHUB_USERS` from `.env`.
2. Restart the development server (`npm run dev`).
3. Navigate to `http://localhost:3000/login` and attempt to sign in with any GitHub account that would otherwise be allowed.
4. Observe the outcome.

**Expected result:**
- The `signIn` callback in `auth.ts` calls `getAllowedUsers()`, which throws:
  `Error: [kobani] ALLOWED_GITHUB_USERS is not set or empty. Set it to a comma-separated list of GitHub usernames in your .env file.`
- Auth.js catches the thrown error from `signIn` callback and treats it as a sign-in failure.
- The user is redirected to `/unauthorized` (since `pages.error: '/unauthorized'` is set) or to `/login?error=...` — verify which.
- The specific error message appears in the server console/terminal output.

**Pass criteria:**
- [ ] The error `[kobani] ALLOWED_GITHUB_USERS is not set or empty...` appears in server-side logs.
- [ ] No user is granted access (the error is thrown before `allowed.has()` is evaluated, so the function does not return `false` — it throws, which Auth.js maps to a sign-in failure).
- [ ] The UI does not crash with an unhandled exception page; it shows the standard denied/error page.

**Unit test coverage:** See section [Unit-Testable Logic](#unit-testable-logic) — `getAllowedUsers()` throwing when env var is empty is directly unit-testable without a GitHub round-trip.

---

### TC-11 — Whitelist Case-Insensitivity

**Category:** Whitelist correctness  
**Priority:** P1

**Prerequisites:**
- `ALLOWED_GITHUB_USERS` is set with an uppercase version of a username, e.g., `ALLOWED_GITHUB_USERS=ALICE` where Account A's actual GitHub login is `alice`.

**Steps:**
1. Sign in with Account A (GitHub login: `alice`, all lowercase).
2. Observe whether access is granted or denied.

**Expected result:**
- Access is granted. The whitelist check in `auth.ts` lowercases both the env var entry and the incoming `profile.login` before comparison:
  - `'ALICE'.trim().toLowerCase()` → `'alice'`  
  - `'alice'.toLowerCase()` → `'alice'`  
  - `allowed.has('alice')` → `true`

**Pass criteria:**
- [ ] User lands on `/` (board list), not `/unauthorized`.
- [ ] The username is displayed correctly in the nav as `@alice` (the original casing from `profile.login` as stored in `token.githubUsername` by the `jwt` callback).

**Inverse test:**  
Set `ALLOWED_GITHUB_USERS=alice` and sign in with a GitHub account whose login is `Alice` (impossible in practice since GitHub enforces case-insensitive uniqueness, but confirms the lowercasing works in both directions — this is best verified via unit test; see section below).

---

### TC-12 — Invalid GitHub Username Format: GITHUB_LOGIN_RE Rejection

**Category:** Input validation / defense in depth  
**Priority:** P1

**Prerequisites:**
- This scenario requires a mock or unit test because GitHub's own validation prevents real accounts from having invalid usernames (GitHub enforces `/^[a-z0-9-]{1,39}$/i`).

**Manual verification steps (server-side inspection):**
1. Add a temporary `console.log` in the `signIn` callback (before the regex check) that logs `profile?.login`.
2. Trigger a sign-in with a valid GitHub account.
3. Verify the logged value passes the regex.
4. Remove the temporary log.

**Unit test approach (preferred — see unit test section):**
- Call the `signIn` callback logic directly with a synthetic `profile` whose `login` is set to:
  - `''` (empty string) → should reject
  - `'user@name'` (contains `@`) → should reject
  - `'a'.repeat(40)` (40 chars, one over the 39-char limit) → should reject
  - `'valid-user-123'` (valid) → should pass regex
  - `null` / `undefined` → should reject (falls back to `''`, which fails regex `{1,39}`)

**Expected result for each malformed input:** `signIn` callback returns `false`, no session is created, user lands on `/unauthorized`.

**Pass criteria:**
- [ ] Regex `^[a-z0-9-]{1,39}$` (case-insensitive) correctly accepts `[a-z0-9-]` characters 1–39 chars long.
- [ ] Any value outside this range causes the `signIn` callback to return `false` before the whitelist check is even reached.
- [ ] Unit tests cover all edge cases listed above (see unit test section).

---

## What Cannot Be Automated Easily

The following scenarios require a real GitHub OAuth round-trip — they involve actual browser redirects to `github.com`, real credential submission, and OAuth callbacks to a registered OAuth App. They cannot be meaningfully exercised with unit tests or integration tests that mock the OAuth flow.

| Scenario | Why it requires a real round-trip |
|---|---|
| TC-01 Happy path | Requires a real GitHub account to complete the OAuth authorization page and generate a real authorization code and access token |
| TC-02 Blocked user | Same as above — Auth.js exchanges the code for a real `profile.login` value; the whitelist check happens inside the real callback |
| TC-05 callbackUrl restoration | Requires following the full redirect chain from `/login` → `github.com` → `/api/auth/callback/github` → final destination |
| TC-06 Open-redirect (layer 2 — Auth.js validation) | Auth.js's internal `redirectTo` validation during callback cannot be triggered without a real callback URL and code exchange |
| TC-09 Sign-out | Requires a real session cookie obtained via a real OAuth flow; mocking `useSession()` does not test the actual cookie deletion behavior |
| TC-11 Case-insensitivity (E2E confirmation) | GitHub's API response casing of `profile.login` can only be confirmed against a real account |

**Practical approach for these tests:** Execute them manually in a staging environment with a dedicated test GitHub OAuth App (separate `GITHUB_ID`/`GITHUB_SECRET` from production) and two dedicated test GitHub accounts. These should be part of the pre-release checklist and re-run after any changes to `auth.ts`, `middleware.ts`, `app/login/page.tsx`, or `app/_components/GitHubSignInButton.tsx`.

---

## Unit-Testable Logic

The following logic is pure or near-pure and can be tested with Vitest (which is already used in `lib/__tests__/`) without any browser, network, or GitHub dependency.

### 1. `getAllowedUsers()` — Whitelist parsing and validation

File target: `auth.ts` — extract `getAllowedUsers` to a separate module (e.g., `lib/auth-utils.ts`) so it can be imported in tests without pulling in the full NextAuth config.

```typescript
// lib/__tests__/auth-utils.test.ts

describe('getAllowedUsers', () => {
  it('returns a Set of lowercased usernames', () => {
    process.env.ALLOWED_GITHUB_USERS = 'Alice,Bob,CHARLIE';
    const users = getAllowedUsers();
    expect(users).toEqual(new Set(['alice', 'bob', 'charlie']));
  });

  it('trims whitespace from entries', () => {
    process.env.ALLOWED_GITHUB_USERS = ' alice , bob ';
    expect(getAllowedUsers()).toEqual(new Set(['alice', 'bob']));
  });

  it('throws when ALLOWED_GITHUB_USERS is empty string', () => {
    process.env.ALLOWED_GITHUB_USERS = '';
    expect(() => getAllowedUsers()).toThrow('[kobani] ALLOWED_GITHUB_USERS is not set or empty');
  });

  it('throws when ALLOWED_GITHUB_USERS is only commas/whitespace', () => {
    process.env.ALLOWED_GITHUB_USERS = ' , , ';
    expect(() => getAllowedUsers()).toThrow('[kobani] ALLOWED_GITHUB_USERS is not set or empty');
  });

  it('throws when ALLOWED_GITHUB_USERS is unset (undefined)', () => {
    delete process.env.ALLOWED_GITHUB_USERS;
    expect(() => getAllowedUsers()).toThrow('[kobani] ALLOWED_GITHUB_USERS is not set or empty');
  });
});
```

### 2. `GITHUB_LOGIN_RE` — Username format validation

```typescript
// lib/__tests__/auth-utils.test.ts

const GITHUB_LOGIN_RE = /^[a-z0-9-]{1,39}$/i;

describe('GITHUB_LOGIN_RE', () => {
  const valid = ['alice', 'bob-smith', 'user123', 'a', 'a'.repeat(39), 'A-B-C'];
  const invalid = [
    '',                          // empty
    'a'.repeat(40),              // 40 chars — one over limit
    'user@name',                 // contains @
    'user.name',                 // contains .
    'user_name',                 // contains _
    'user name',                 // contains space
    '-startswith-hyphen',        // starts with hyphen (valid per GitHub actually — test per regex)
  ];

  test.each(valid)('accepts valid login: %s', (login) => {
    expect(GITHUB_LOGIN_RE.test(login)).toBe(true);
  });

  test.each(invalid)('rejects invalid login: %s', (login) => {
    expect(GITHUB_LOGIN_RE.test(login)).toBe(false);
  });

  it('rejects null/undefined by converting to empty string', () => {
    expect(GITHUB_LOGIN_RE.test((null as unknown as string) ?? '')).toBe(false);
    expect(GITHUB_LOGIN_RE.test((undefined as unknown as string) ?? '')).toBe(false);
  });
});
```

### 3. callbackUrl validation — Same logic used in middleware and login page

Both `middleware.ts` (line 13) and `app/login/page.tsx` (line 18) use the same pattern:
```typescript
raw.startsWith('/') && !raw.startsWith('//')
```

```typescript
// lib/__tests__/auth-utils.test.ts

function isSafeCallbackUrl(raw: string | undefined): boolean {
  return !!(raw && raw.startsWith('/') && !raw.startsWith('//'));
}

describe('isSafeCallbackUrl', () => {
  it('accepts root path', () => expect(isSafeCallbackUrl('/')).toBe(true));
  it('accepts deep relative path', () => expect(isSafeCallbackUrl('/boards/123')).toBe(true));
  it('accepts path with query string', () => expect(isSafeCallbackUrl('/boards?view=list')).toBe(true));
  it('rejects protocol-relative URL', () => expect(isSafeCallbackUrl('//evil.com')).toBe(false));
  it('rejects absolute https URL', () => expect(isSafeCallbackUrl('https://evil.com')).toBe(false));
  it('rejects absolute http URL', () => expect(isSafeCallbackUrl('http://localhost:3000/')).toBe(false));
  it('rejects javascript: URI', () => expect(isSafeCallbackUrl('javascript:alert(1)')).toBe(false));
  it('rejects empty string', () => expect(isSafeCallbackUrl('')).toBe(false));
  it('rejects undefined', () => expect(isSafeCallbackUrl(undefined)).toBe(false));
  it('rejects bare domain without protocol', () => expect(isSafeCallbackUrl('evil.com/path')).toBe(false));
});
```

### 4. signIn callback — Whitelist check logic

The `signIn` callback can be unit tested by mocking `process.env.ALLOWED_GITHUB_USERS` and calling the extracted logic with synthetic profile objects:

```typescript
describe('signIn callback logic', () => {
  it('returns false for empty login', () => {
    process.env.ALLOWED_GITHUB_USERS = 'alice';
    expect(signInCheck({ login: '' })).toBe(false);
  });

  it('returns false for login failing regex', () => {
    process.env.ALLOWED_GITHUB_USERS = 'alice';
    expect(signInCheck({ login: 'user@name' })).toBe(false);
  });

  it('returns false for login not in whitelist', () => {
    process.env.ALLOWED_GITHUB_USERS = 'alice';
    expect(signInCheck({ login: 'bob' })).toBe(false);
  });

  it('returns true for login in whitelist', () => {
    process.env.ALLOWED_GITHUB_USERS = 'alice';
    expect(signInCheck({ login: 'alice' })).toBe(true);
  });

  it('returns true for login matching whitelist case-insensitively', () => {
    process.env.ALLOWED_GITHUB_USERS = 'ALICE';
    expect(signInCheck({ login: 'alice' })).toBe(true);
  });

  it('throws when ALLOWED_GITHUB_USERS is unset', () => {
    delete process.env.ALLOWED_GITHUB_USERS;
    expect(() => signInCheck({ login: 'alice' })).toThrow('[kobani] ALLOWED_GITHUB_USERS');
  });

  it('returns false for undefined login', () => {
    process.env.ALLOWED_GITHUB_USERS = 'alice';
    expect(signInCheck({ login: undefined })).toBe(false);
  });
});
```

Note: To make `signIn` callback logic unit-testable, `getAllowedUsers` and the login check should be extracted from the NextAuth config closure into a named, exportable function in a separate module (e.g., `lib/auth-utils.ts`). The current inline definition in `auth.ts` is not directly importable without pulling in the full NextAuth setup.

---

## Pre-Deployment Checklist

Run these checks before any non-localhost deployment:

- [ ] TC-01 Happy path passes end-to-end.
- [ ] TC-02 Blocked user redirects to `/unauthorized` with neutral copy.
- [ ] TC-03 `curl /api/boards` returns `401 {"error":"Unauthorized"}`.
- [ ] TC-07 `curl /api/events/<cardId>` returns `401 {"error":"Unauthorized"}`.
- [ ] TC-06 Open-redirect tests A and B pass (no external redirect after OAuth).
- [ ] TC-08 Session cookie `Max-Age` is 86400 (not 2592000).
- [ ] TC-09 Sign-out clears cookie and subsequent navigation redirects to `/login`.
- [ ] TC-10 Starting with `ALLOWED_GITHUB_USERS=` (empty) logs the expected error and blocks all logins.
- [ ] All unit tests in `lib/__tests__/auth-utils.test.ts` pass (`npm test`).

---

## Known Limitations and Out-of-Scope Items

The following behaviors are documented in `SECURITY_REVIEW.md` and are accepted limitations for v1 — they are not test failures:

1. **Active SSE streams are not terminated on session expiry.** A stream opened by an authenticated user will remain open until the client disconnects or the server restarts, even if the session JWT expires mid-stream. New connection attempts after expiry will correctly receive 401. (SECURITY_REVIEW Finding 4.2)

2. **No per-request whitelist re-validation.** A user removed from `ALLOWED_GITHUB_USERS` retains access until their 24-hour session expires or `AUTH_SECRET` is rotated and a redeploy is triggered. The revocation window is approximately 2–10 minutes for a successful redeploy. A failed deploy leaves the old whitelist live indefinitely. (SECURITY_REVIEW Finding 5.1)

3. **No individual session revocation.** There is no server-side session store; the only way to invalidate a specific user's session before expiry is to rotate `AUTH_SECRET` (which logs out all users). (SECURITY_REVIEW Finding 2.3)

4. **`AUTH_SECRET` rotation requires a redeploy to take effect.** Updating the environment variable in the deployment dashboard without triggering a new build does not invalidate existing sessions. (SECURITY_REVIEW Finding 6.1)

5. **`approvedBy` field is not server-enforced.** A raw API call can set `approvedBy` to any string. This will be addressed in a follow-up. (SECURITY_REVIEW Finding 7.4)

6. **No rate limiting on `/api/auth/signin`.** Username enumeration via repeated OAuth flows is theoretically possible. Platform-level rate limiting (Vercel, Cloudflare) is the recommended mitigation. (SECURITY_REVIEW Finding 10.1)
