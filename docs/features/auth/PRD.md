# PRD: Authentication & Access Control

**Product:** Kobani  
**Feature:** GitHub OAuth + User Whitelist  
**Status:** Draft  
**Author:** Lucas Bais  
**Date:** 2026-04-13

---

## 1. Problem Statement

Kobani's REST API is fully unauthenticated. Any network-accessible request can:

- Create and modify Kanban cards (`POST /api/boards/:id/cards`, `PATCH /api/cards/:id`)
- Move cards between columns (`POST /api/cards/:id/move`), which triggers the orchestrator to dispatch an Anthropic Managed Agent session
- Read live agent output (`GET /api/events/:cardId`) streamed via SSE
- Read the full board state including card descriptions and acceptance criteria (`GET /api/boards/:id`)

The critical risk is financial: moving a card into an active column unconditionally spawns an Anthropic agent session and begins consuming API tokens. With `MAX_CONCURRENT_AGENTS` defaulting to 5 and `MAX_ATTEMPTS` defaulting to 5, a single unauthenticated burst of card-move requests can fan out to 25 agent runs before the orchestrator's concurrency cap stops further launches. There is no rate-limiting, no audit trail, and no way to identify who triggered a run.

Secondary risks include data confidentiality (card descriptions often contain internal task details or repository references) and data integrity (unauthenticated writes can corrupt board state).

This feature introduces the minimum viable access control needed to close these gaps before any shared or internet-facing deployment of the app.

---

## 2. Goals

- Allow known, explicitly approved users to sign in using their existing GitHub identity — no new passwords or account registration.
- Block everyone not on the whitelist before they can touch any protected resource, in the API layer as well as the UI.
- Give the admin a simple, zero-UI mechanism to add or remove users (an environment variable for v1).
- Preserve the existing dark/minimal UI aesthetic; auth surfaces should feel like a first-class part of the product, not a bolt-on.
- Keep the implementation small enough that the team can ship it in one focused sprint without touching orchestrator or agent-runner logic.

## 2.1 Non-Goals

- Self-serve registration: users cannot sign themselves up; all access is granted by the admin.
- Role hierarchy: all whitelisted users have identical permissions in v1. There is no read-only or admin role distinction in the UI.
- Multiple OAuth providers (Google, email/password, etc.). GitHub is the only provider in v1 because the existing codebase already uses GitHub PATs for repo mounting, so GitHub accounts are a natural anchor identity.
- Per-user or per-board access scoping: whitelist membership is binary (in or out).
- Audit logging of individual API calls (logged as a future option under Open Questions).
- Two-factor authentication beyond what GitHub already enforces on its own login.
- The `GITHUB_TOKEN` environment variable used for repo mounting is unrelated and unchanged.

---

## 3. User Stories

### 3.1 Allowed user — sign in and work normally

> As a whitelisted engineer, I want to sign in with my GitHub account so that I can access the Kobani board and manage cards without re-entering credentials on every visit.

Acceptance criteria:
- Clicking "Sign in with GitHub" redirects me to GitHub's OAuth authorization page.
- After authorizing, I am redirected back to Kobani and land on the page I was trying to reach (or the board list if there was no prior destination).
- My GitHub avatar and username are visible in the top navigation's user menu.
- My session persists across browser tab reopens for up to 24 hours before I must re-authenticate.
- I can sign out from the user menu, which clears my session immediately.

### 3.2 Blocked user — rejected at the gate

> As someone whose GitHub username is not on the whitelist, I want to see a clear message explaining I don't have access, rather than a silent error or a crash.

Acceptance criteria:
- After completing GitHub's OAuth flow, if my username is not in `ALLOWED_GITHUB_USERS`, I am redirected to a dedicated "Access denied" page.
- The page explains that access is restricted and tells me to contact the admin.
- No session is created; I cannot access any protected route by manipulating cookies or guessing URLs.
- API routes return `401 Unauthorized` with a JSON body `{ "error": "Unauthorized" }` for unauthenticated requests, and `403 Forbidden` with `{ "error": "Forbidden" }` for authenticated-but-not-whitelisted requests.

### 3.3 Admin — add a new user to the whitelist

> As the admin, I want to grant a new team member access by adding their GitHub username to the configuration, so they can sign in on their next visit without any database migration or UI action.

Acceptance criteria:
- The admin adds the GitHub username (exact, case-insensitive match) to the `ALLOWED_GITHUB_USERS` environment variable and redeploys (or restarts the dev server).
- The new user can immediately sign in via GitHub OAuth and land on the board.
- No database change, no dashboard action, and no application code change is required.

### 3.4 Admin — remove a user

> As the admin, I want to revoke a team member's access by removing their username from the whitelist, so that they cannot create new sessions after the next deploy.

Acceptance criteria:
- After removing the username from `ALLOWED_GITHUB_USERS` and redeploying, any new sign-in attempt by that user lands on the "Access denied" page.
- Existing unexpired sessions held by that user become invalid after the deploy, because the whitelist is re-evaluated at sign-in time on each server instance; a server restart with the updated env var means no new session can be established.
- If the user must be removed before the next scheduled deploy, the admin rotates `AUTH_SECRET`, which invalidates all existing sessions immediately (all users must re-authenticate).

---

## 4. Functional Requirements

### 4.1 Sign-In Flow

1. Unauthenticated users who visit any protected route are redirected to `/auth/signin`.
2. `/auth/signin` displays a single "Sign in with GitHub" button. No username/password fields. The page carries the original destination URL as a `callbackUrl` query parameter.
3. Clicking the button initiates the GitHub OAuth authorization code flow. The OAuth `state` parameter must be generated per-session and verified on callback to prevent CSRF.
4. GitHub redirects to `/api/auth/callback/github` with the authorization code.
5. The server exchanges the code for an access token, fetches the authenticated user's GitHub login (`/user` endpoint), and checks it against the whitelist.
6. If the username is on the whitelist:
   a. A signed, encrypted session cookie is created containing at minimum: `githubUsername`, `githubAvatarUrl`, `sessionExpiresAt`.
   b. The user is redirected to `callbackUrl` (validated to be a relative path within the app, not an arbitrary external URL).
7. If the username is not on the whitelist, the user is redirected to `/auth/denied` and no session is created.

### 4.2 Whitelist Enforcement

- The whitelist is read from the `ALLOWED_GITHUB_USERS` environment variable: a comma-separated list of GitHub usernames, e.g. `alice,bob,carol`.
- Comparison is case-insensitive. Leading/trailing whitespace around each entry is trimmed.
- The whitelist is evaluated at sign-in only (step 5 above), inside the Auth.js `signIn` callback. A session is created only if the username is present in the whitelist at that moment. Subsequent requests are verified only for a valid, non-expired session cookie — the username is not re-checked against the env var on every request.
- This is intentional: because `ALLOWED_GITHUB_USERS` is an environment variable, any change to it requires a redeploy, which restarts the server. The deploy boundary is the enforcement boundary — a removed user cannot sign in on the new server instance, and their existing JWT session cookie will have been issued against the previous instance. No per-request lookup overhead is needed to achieve this guarantee.
- If `ALLOWED_GITHUB_USERS` is not set, set to an empty string, or set to a string that contains only whitespace or commas (i.e. produces zero valid entries after trimming and filtering), the app must fail closed: refuse to start in development with a clear error message, and return HTTP 503 in production. An empty string and an unset variable are treated identically — both are startup failures. This prevents accidental open access from a misconfigured deploy. Note: the natural behavior of an empty parsed list is to block all sign-ins silently, which is fail-closed but produces no diagnostics; the startup check is required so that the misconfiguration is visible to the operator immediately.

### 4.3 Session Lifetime & Storage

- Sessions are stored as signed, encrypted HTTP-only cookies (`SameSite=Lax`, `Secure` in production).
- Maximum session lifetime: **24 hours** from the time of sign-in. This must be set explicitly in `auth.ts` as `session: { maxAge: 24 * 60 * 60 }`. Auth.js v5's library default is 30 days; the implementation must not rely on that default. The 24-hour cap is required because this design enforces the whitelist only at sign-in — a removed user retains access until their session expires or `AUTH_SECRET` is rotated. A 30-day residual window is not acceptable under that model.
- Sessions are not stored server-side in v1; the cookie is the sole session token. This avoids adding a Redis or DB-backed session store in the first iteration.
- Sessions are not refreshed on activity in v1 — they expire at the fixed timestamp baked into the cookie at sign-in. Users must re-authenticate every 24 hours.

### 4.4 Sign-Out

- A "Sign out" option is available in the `UserMenu` component in the top navigation.
- Clicking it calls `POST /api/auth/signout`, which clears the session cookie and redirects to `/auth/signin`.
- Sign-out is immediate and does not require any server-side state invalidation (since there is no server-side session store in v1).

### 4.5 Protected Routes

All routes are protected by default via Next.js middleware that runs before every request. The following routes are explicitly public (whitelisted from protection):

| Path pattern | Reason |
|---|---|
| `/auth/signin` | Sign-in page must be accessible unauthenticated |
| `/auth/denied` | Access-denied page must be accessible unauthenticated |
| `/api/auth/callback/github` | OAuth callback must be reachable by GitHub's redirect |
| `/api/auth/signout` | Sign-out must be callable (though it only clears cookies) |
| `/_next/*` | Static assets, build chunks |
| `/logo.png`, `/favicon.ico` | Public static files |

Every other route — including all `/api/*` routes — requires a valid, non-expired session cookie with a whitelisted GitHub username. This covers:

- `GET /api/boards` — board list
- `GET /api/boards/:id` — board detail with cards and agent runs
- `POST /api/boards/:id/cards` — create card (triggers potential agent run on move)
- `PATCH /api/cards/:id` — update card
- `POST /api/cards/:id/move` — the highest-risk route; triggers orchestrator dispatch
- `GET /api/events/:cardId` — SSE agent output stream
- All UI pages (`/`, `/boards/:id`, `/attention`)

### 4.6 Rate Limiting on Sign-In

The sign-in endpoint (`/api/auth/signin` and the OAuth callback at `/api/auth/callback/github`) must be rate limited to prevent whitelist enumeration. Without throttling, an attacker can repeatedly initiate OAuth flows with different GitHub accounts and infer which usernames are on the whitelist by observing whether they land on the board or the access-denied page.

Requirements:
- Rate limiting must be applied at the platform or edge layer (Vercel edge rate limiting, Cloudflare, or equivalent WAF). Application-level rate limiting in Next.js middleware is not sufficient because it runs after the request reaches the origin.
- The sign-in initiation endpoint must be limited to no more than **10 requests per IP per minute**.
- Allowed and denied callback responses must have identical artificial latency so that timing differences do not leak whitelist membership. Auth.js's default behavior provides approximately uniform response time; do not short-circuit the callback path for the denied case in a way that makes it measurably faster.
- In development, rate limiting may be disabled. The requirement applies to any deployment reachable from the public internet.

### 4.7 Audit Logging of Agent Run Triggers

Every agent run must record which authenticated GitHub user triggered it. This provides cost attribution and an investigation trail if unexpected agent runs occur.

Requirements:
- When `POST /api/cards/:id/move` moves a card into an active column and triggers an agent run, the handler must write `session.user.githubUsername` to the `AgentRun` record. The field name is `triggeredBy`.
- `triggeredBy` must be set **server-side from the authenticated session**. It must never be accepted from the request body — client-supplied identity claims must be ignored entirely.
- The same principle applies to the `approvedBy` field on cards. If a `PATCH /api/cards/:id` request includes `approvedBy` in the body, the handler must ignore that value and instead write `session.user.githubUsername` from the authenticated session. The client UI may display the field, but it must not be the source of record.
- `triggeredBy` on `AgentRun` and `approvedBy` on `Card` are nullable to allow historical records created before auth was in place.

### 4.8 Sign-In Page UI

The sign-in page (`/auth/signin`) must match the existing dark/minimal aesthetic:

- Background: `bg-zinc-950` (matches app body).
- The Kobani logo and wordmark centered above the button (same treatment as the TopNav brand).
- A single primary button: "Sign in with GitHub" using the GitHub mark icon alongside the label. Button styling consistent with existing interactive elements (solid, slightly rounded, no heavy drop shadows).
- No registration link, no password field, no "forgot password".
- A brief one-line description: "Sign in to access your team's Kobani board."

The "Access denied" page (`/auth/denied`) shows:

- Same dark background and logo.
- Message: "Access restricted. Contact your team admin to request access." — the message must not name the authentication provider (GitHub), confirm that OAuth is used, or describe the whitelist mechanism. This limits information disclosed to unauthenticated visitors.
- A generic "Sign in" link that routes back to `/auth/signin`. Do not include text like "sign in with a different account" that implies which provider is in use.
- The page must not include the rejected GitHub username in the URL, query parameters, or visible text. Pass the denial state via a short-lived server-side flag (e.g. a `Set-Cookie: authError=denied; Path=/auth/denied; Max-Age=30; HttpOnly`) rather than a URL parameter, so the username does not appear in browser history, access logs, or analytics tools.

---

## 5. Whitelist Management

### 5.1 v1: Environment Variable

The admin controls access by setting:

```
ALLOWED_GITHUB_USERS=alice,bob,carol
```

This is added to `.env.local` for development and to the deployment environment (e.g. Vercel project environment variables, Fly.io secrets) for production.

**Workflow for adding a user:**
1. Admin gets the new user's GitHub username (ask them or look up their profile).
2. Append the username to `ALLOWED_GITHUB_USERS` in the deployment environment.
3. Redeploy or restart the server. The new user can sign in immediately after the restart.

**Workflow for removing a user:**
1. Remove the username from `ALLOWED_GITHUB_USERS`.
2. Redeploy or restart. Because the whitelist is checked at sign-in and the new server instance carries the updated env var, the removed user cannot establish a new session. Any existing JWT session cookie they hold was signed by the previous server; it will expire naturally within the configured session lifetime (24 hours maximum — see section 4.3).

**Enforcement boundary:** Per-request whitelist re-evaluation is explicitly not required. `ALLOWED_GITHUB_USERS` is an environment variable — changing it mandates a redeploy, and a redeploy restarts the server. The deploy cycle is itself the revocation event. This avoids per-request env-var parsing overhead with no meaningful loss of security for a team-internal tool operating on a normal deploy cadence.

**Emergency revocation:** If a user must be removed before the next scheduled deploy, rotate `AUTH_SECRET`. All outstanding JWT session cookies are immediately invalidated (because they can no longer be verified against the new secret) and every user must re-authenticate. This is a blunt instrument that logs everyone out, but it is the correct tool for an urgent revocation scenario.

### 5.2 Future Option: DB-Backed Whitelist

A later iteration could move the whitelist into a `AllowedUser` Prisma model with an admin UI panel (accessible only to users flagged `isAdmin: true`). This would enable:

- Real-time add/remove without redeployment.
- An audit log of who granted access and when.
- Per-user metadata (display name, added date, added by).

The env-var approach in v1 is intentionally chosen for zero-schema-migration risk during the initial auth sprint.

---

## 6. Security Requirements

### 6.1 Session Cookie

- The session cookie must be signed with a secret (`AUTH_SECRET` env var, minimum 32 random bytes) and encrypted so its contents cannot be read or tampered with by the client.
- `HttpOnly: true` — not accessible via JavaScript.
- `SameSite=Lax` — mitigates CSRF for state-changing requests.
- `Secure: true` in production (HTTPS only).
- The cookie must not store the GitHub OAuth access token. Only the GitHub username, avatar URL, and session expiry are stored.

### 6.2 OAuth State Parameter

The OAuth `state` parameter must be a cryptographically random value stored in a short-lived cookie and verified on callback. Mismatch must abort the flow with an error redirect to `/auth/signin?error=state_mismatch`.

### 6.3 Callback URL Validation

The `callbackUrl` redirect target after sign-in must be validated to allow only same-origin relative paths. The validation must be applied in application code before the value is passed to Auth.js — do not delegate this check entirely to the library.

A valid `callbackUrl` must:
- Start with `/` (ensuring it is a relative path, not a protocol-relative or absolute URL)
- Not start with `//` (which browsers treat as a protocol-relative URL, enabling cross-origin redirect)
- Not contain a scheme component (`http:`, `https:`, `javascript:`, etc.)

In practice, the server action on the sign-in page must sanitize the value before passing it to `signIn`:

```ts
const cb = searchParams.callbackUrl;
const safeCallbackUrl = cb?.startsWith('/') && !cb.startsWith('//') ? cb : '/';
await signIn('github', { redirectTo: safeCallbackUrl });
```

Any `callbackUrl` that fails validation must be silently replaced with `/` (the board list). No error should be shown to the user — an invalid redirect target is not a user error worth surfacing.

### 6.4 Information Disclosure on Unauthorized Pages

The `/auth/denied` page and all auth error responses must not reveal implementation details to unauthenticated visitors:

- Error pages must not name the OAuth provider (GitHub), confirm the authentication mechanism (OAuth, SSO, etc.), or describe the whitelist.
- The message "Access restricted. Contact your team admin to request access." is the required wording. Do not augment it with technical detail.
- Rejected usernames must not appear in URLs, query parameters, page content, or page titles. They must not be passed through URL parameters where they could be captured by browser history, server access logs, or any analytics tool. Use a short-lived `HttpOnly` cookie to carry the denial state from the callback to the denied page if any server-side context is needed.
- The `/auth/denied` page must be indistinguishable in structure from a generic app error page to an unauthenticated visitor who reaches it directly (e.g., by guessing the URL). It should not confirm that the app requires authentication or that an OAuth flow was recently attempted.

### 6.5 Unauthorized Access Responses

| Scenario | HTTP status | Body |
|---|---|---|
| No session cookie | 401 | `{ "error": "Unauthorized" }` |
| Expired session cookie | 401 | `{ "error": "Unauthorized" }` |
| API route response | JSON | As above |
| UI route response | Redirect | → `/auth/signin?callbackUrl=<original-path>` |

Note: there is no runtime 403 path for "valid session but username since removed from whitelist." Because whitelist changes require a redeploy, a user whose access has been removed will find their session naturally invalid after the redeploy (new `AUTH_SECRET` rotation) or unable to create a new session. The 403/Forbidden response code is therefore not used in normal operation in this design.

### 6.6 Token Security

- `AUTH_SECRET` must be set as an environment variable and must never be committed to source control.
- `.env.local` is already in `.gitignore`; ensure `.env.example` documents `AUTH_SECRET` as a required variable with a note to generate a strong random value (e.g. `openssl rand -hex 32`).
- The GitHub OAuth `client_id` and `client_secret` must also be stored as environment variables (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`), never hardcoded.

### 6.7 Implementation Library Recommendation

Using [Auth.js v5](https://authjs.dev) (NextAuth.js) is the recommended implementation path. It handles the OAuth state, PKCE, JWT signing/encryption, cookie management, and callback URL validation out of the box.

The whitelist check is implemented exclusively in Auth.js's `signIn` callback, which executes server-side before a session token is issued:

```ts
// auth.ts
signIn({ profile }) {
  const allowed = (process.env.ALLOWED_GITHUB_USERS ?? '')
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(profile.login.toLowerCase());
}
```

The Next.js middleware uses Auth.js's `authorized` callback only to verify that a valid, non-expired JWT exists — it does not re-read `ALLOWED_GITHUB_USERS`. This aligns with the deploy-boundary enforcement model: the whitelist gates session creation; middleware gates route access by session presence alone.

---

## 7. Environment Variables

The following new variables are required in addition to the existing ones documented in `README.md`:

| Variable | Required | Description |
|---|---|---|
| `GITHUB_CLIENT_ID` | Yes | OAuth App client ID from GitHub (Settings → Developer Settings → OAuth Apps) |
| `GITHUB_CLIENT_SECRET` | Yes | OAuth App client secret |
| `ALLOWED_GITHUB_USERS` | Yes | Comma-separated GitHub usernames that may sign in (e.g. `alice,bob`) |
| `AUTH_SECRET` | Yes | Min 32-byte random secret for signing/encrypting JWT session cookies (e.g. `openssl rand -hex 32`). Rotating this value immediately invalidates all active sessions. |
| `NEXTAUTH_URL` | Yes (prod) | Canonical base URL of the app, e.g. `https://kobani.example.com`. Not needed in local dev if using default `http://localhost:3000`. |

The GitHub OAuth App must be configured with:
- **Homepage URL:** the app's base URL
- **Authorization callback URL:** `<base-url>/api/auth/callback/github`

---

## 8. Open Questions

1. ~~**Session invalidation on whitelist removal.**~~ Resolved: per-request whitelist re-evaluation is not required. The deploy boundary is the enforcement boundary. Emergency revocation is handled by rotating `AUTH_SECRET`. See sections 4.2 and 5.1.

2. **GitHub OAuth App vs GitHub App.** A standard OAuth App is simplest. A GitHub App offers finer-grained permissions but adds installation complexity. Do we have any reason to use a GitHub App here?

3. ~~**Which GitHub OAuth scopes?**~~ Resolved by security review (Finding 7.2): `read:user` scope only. No `repo` or email scope needed. The OAuth token is not stored in the session; only username and avatar URL are retained.

4. **Multi-board access.** If Kobani is eventually deployed as a shared service with multiple teams each owning their own boards, the binary whitelist becomes insufficient. Should we design the whitelist data model now with per-board scoping in mind, or defer that entirely?

5. ~~**Audit logging.**~~ Resolved: required. `triggeredBy` (populated from `session.user.githubUsername`) must be written to every `AgentRun` record. `approvedBy` on `Card` must also be set server-side from the session. Client-supplied values for both fields must be ignored. See section 4.7.

6. **SSE `withCredentials` and session expiry behavior.** The `useEventSource` hook must use `withCredentials: true` so that the session cookie is sent with the `EventSource` request. If the session expires while a stream is open, the server cannot retroactively reject the connection — the stream remains alive until the client disconnects or the server closes it. This is a known limitation of stateless JWT sessions combined with long-lived SSE connections. Acceptable for v1, but the `useEventSource` hook must handle 401 on reconnect attempts by redirecting to `/auth/signin` rather than looping. Does the team want to cap maximum SSE connection lifetime at something shorter than the session max-age (24 hours) to bound this window?

7. ~~**Deployment-time startup validation.**~~ Resolved: fail-closed in all environments. Both an unset and an empty `ALLOWED_GITHUB_USERS` are treated as startup failures. See section 4.2.
