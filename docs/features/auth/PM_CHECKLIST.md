# PM Requirements Checklist — Auth & Access Control

**PRD:** `docs/features/auth/PRD.md`  
**Date reviewed:** 2026-04-13  
**Status legend:** ✅ Covered · ⚠️ Partially covered · ❌ Not covered

---

## Section 4.1 — Sign-In Flow

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| 4.1.1 | Unauthenticated users visiting any protected route are redirected to `/auth/signin` | ⚠️ | `middleware.ts` | Middleware redirects to `/login`, not `/auth/signin`. The PRD mandates the `/auth/signin` path; the implementation uses `/login`. Path mismatch with PRD spec. |
| 4.1.2 | Sign-in page shows a single "Sign in with GitHub" button; no username/password; carries `callbackUrl` query param | ✅ | `app/login/page.tsx`, `app/_components/GitHubSignInButton.tsx` | `callbackUrl` is forwarded; single GitHub button; no password field. |
| 4.1.3 | GitHub OAuth authorization code flow with per-session `state` parameter verified on callback to prevent CSRF | ✅ | `auth.ts`, `app/api/auth/[...nextauth]/route.ts` | Auth.js v5 handles state/PKCE natively. |
| 4.1.4 | GitHub redirects to `/api/auth/callback/github` | ✅ | `app/api/auth/[...nextauth]/route.ts` | Standard Auth.js callback route is mounted and excluded from middleware protection. |
| 4.1.5 | Server exchanges code for token, fetches GitHub login, checks against whitelist | ✅ | `auth.ts` (`signIn` callback) | `getAllowedUsers()` is called on every sign-in; username is validated and checked case-insensitively. |
| 4.1.6a | On whitelist match: signed, encrypted session cookie with `githubUsername`, `githubAvatarUrl`, `sessionExpiresAt` | ✅ | `auth.ts` (`jwt` + `session` callbacks), `types/next-auth.d.ts` | JWT strategy; `githubUsername` and `avatarUrl` stored. `sessionExpiresAt` is implicit in JWT `exp` claim (Auth.js standard). |
| 4.1.6b | User redirected to validated `callbackUrl` (relative paths only, no external URLs) | ✅ | `app/login/page.tsx`, `middleware.ts` | `callbackUrl` validated with `startsWith('/')` and `!startsWith('//')` guard in both middleware and login page. |
| 4.1.7 | Non-whitelisted user redirected to `/auth/denied`; no session created | ⚠️ | `auth.ts`, `app/login/page.tsx` | Auth.js redirects to the configured `error` page (`/unauthorized`), not `/auth/denied`. The PRD mandates `/auth/denied`; the implementation uses `/unauthorized`. The `app/unauthorized/page.tsx` file also does not exist yet — the frontend agent lists it as planned but it is not present on disk. |

---

## Section 4.2 — Whitelist Enforcement

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| 4.2.1 | Whitelist read from `ALLOWED_GITHUB_USERS` (comma-separated) | ✅ | `auth.ts` (`getAllowedUsers`) | Split on `,`, trimmed, lowercased. |
| 4.2.2 | Comparison is case-insensitive; leading/trailing whitespace trimmed | ✅ | `auth.ts` (`getAllowedUsers`) | `.trim().toLowerCase()` applied to each entry and to the incoming login. |
| 4.2.3 | Whitelist evaluated at sign-in only (not on every request) | ✅ | `auth.ts` (`signIn` callback), `middleware.ts` | Middleware checks only for a valid non-expired JWT; does not re-read `ALLOWED_GITHUB_USERS`. |
| 4.2.4 | If `ALLOWED_GITHUB_USERS` is unset/empty, app must fail closed: error in dev, HTTP 503 in production | ⚠️ | `auth.ts` (`getAllowedUsers`) | `getAllowedUsers` throws an `Error` when the list is empty, which will crash the sign-in attempt. However, the check runs lazily at first sign-in, not at server startup. The PRD requires a **startup check** with a clear operator-visible error; there is no startup hook (e.g. `instrumentation.ts`) implementing this. Production 503 behavior is not implemented — the thrown error would likely surface as a 500. |

---

## Section 4.3 — Session Lifetime & Storage

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| 4.3.1 | Sessions stored as signed, encrypted `HttpOnly` cookies (`SameSite=Lax`, `Secure` in production) | ✅ | `auth.ts` (JWT strategy via Auth.js) | Auth.js v5 JWT strategy handles this by default. |
| 4.3.2 | Maximum session lifetime **24 hours**, set explicitly as `maxAge: 24 * 60 * 60` | ✅ | `auth.ts` | Explicitly set with comment noting the 30d default must not be used. |
| 4.3.3 | No server-side session store; cookie is the sole session token | ✅ | `auth.ts` | `strategy: 'jwt'` — no DB or Redis session store. |
| 4.3.4 | Sessions not refreshed on activity; expire at fixed timestamp from sign-in | ✅ | `auth.ts` | Auth.js JWT strategy with fixed `maxAge` does not slide on activity. |

---

## Section 4.4 — Sign-Out

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| 4.4.1 | "Sign out" option available in `UserMenu` component in top navigation | ❌ | `app/_components/UserMenu.tsx` | The current `UserMenu.tsx` is a hardcoded placeholder (`LB` initials). It does not show a real avatar, username, dropdown, or sign-out action. The frontend agent plans to replace it, but the file is not yet built. |
| 4.4.2 | Clicking sign-out calls `POST /api/auth/signout`, clears session cookie, redirects to sign-in | ⚠️ | `app/api/auth/[...nextauth]/route.ts` | The Auth.js signout endpoint is mounted. However, since `UserMenu` is a stub, there is no sign-out UI to trigger it. |

---

## Section 4.5 — Protected Routes

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| 4.5.1 | All routes protected by default via Next.js middleware | ✅ | `middleware.ts` | Matcher uses a negative lookahead to protect everything except the public paths. |
| 4.5.2 | `/auth/signin` is public | ⚠️ | `middleware.ts` | Middleware excludes `login$` (maps to `/login`). The PRD specifies `/auth/signin`. Path mismatch — same practical effect, but the spec is not met literally. |
| 4.5.3 | `/auth/denied` is public | ⚠️ | `middleware.ts` | Middleware excludes `unauthorized$` (maps to `/unauthorized`). The PRD specifies `/auth/denied`. Same path-mismatch issue. |
| 4.5.4 | `/api/auth/callback/github` is public | ✅ | `middleware.ts` | Matcher excludes `api/auth(?:/|$)`. |
| 4.5.5 | `/api/auth/signout` is public | ✅ | `middleware.ts` | Covered by the `api/auth(?:/|$)` exclusion. |
| 4.5.6 | `/_next/*` static assets are public | ✅ | `middleware.ts` | `_next/static` and `_next/image` excluded from matcher. |
| 4.5.7 | `/logo.png`, `/favicon.ico` are public | ⚠️ | `middleware.ts` | `favicon.ico` is excluded. `/logo.png` is not explicitly excluded. In practice Next.js serves files in `public/` before the middleware matcher runs, so this is likely safe, but the PRD lists it as an explicit exclusion and it is not present in the matcher. |
| 4.5.8 | All 6 `/api/*` route handlers protected | ⚠️ | `middleware.ts`, individual route handlers | Middleware covers all API routes. Additionally, `GET /api/boards`, `GET /api/boards/:id`, `POST /api/boards/:id/cards`, `GET/PATCH/DELETE /api/cards/:id`, and `POST /api/cards/:id/move` all call `auth()` and return 401 themselves. However, **`GET /api/events/:cardId` (SSE route) has no `auth()` check** — it is protected only by the middleware, not by an in-handler guard. If middleware were bypassed or the matcher changed, the SSE stream would be open. |
| 4.5.9 | All UI pages (`/`, `/boards/:id`, `/attention`) protected | ✅ | `middleware.ts` | Catch-all matcher protects all non-excluded paths. |

---

## Section 4.6 — Rate Limiting on Sign-In

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| 4.6.1 | Sign-in endpoint rate limited at platform/edge layer (not application-level middleware) | ❌ | — | No rate limiting is implemented anywhere in the codebase. The PRD requires this at the platform or edge layer (Vercel edge rate limiting, Cloudflare WAF, etc.). Not a code artifact — must be configured in deployment infrastructure. |
| 4.6.2 | Max 10 requests per IP per minute on sign-in initiation | ❌ | — | Not implemented. |
| 4.6.3 | Allowed and denied callbacks must have identical artificial latency to prevent timing-based whitelist enumeration | ✅ | `auth.ts` | Auth.js's `signIn` callback does not short-circuit — both paths complete the full OAuth flow before redirecting. The implementation follows the PRD's guidance to not short-circuit the denied path. |

---

## Section 4.7 — Audit Logging of Agent Run Triggers

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| 4.7.1 | `POST /api/cards/:id/move` writes `session.user.githubUsername` to `AgentRun.triggeredBy` | ❌ | `app/api/cards/[id]/move/route.ts`, `prisma/schema.prisma` | The `AgentRun` model has no `triggeredBy` field in the schema. The move route handler does not write any user identity to the run record. Both the DB schema change and the handler logic are missing. |
| 4.7.2 | `triggeredBy` must be set server-side; client-supplied identity must be ignored | ❌ | `app/api/cards/[id]/move/route.ts` | Field does not exist yet (see 4.7.1). |
| 4.7.3 | `PATCH /api/cards/:id` sets `approvedBy` from `session.user.githubUsername`, ignoring client-supplied value | ✅ | `app/api/cards/[id]/route.ts` | Line 49 writes `session.user.githubUsername` explicitly with comment "NEVER trust the client-supplied value". |
| 4.7.4 | `triggeredBy` and `approvedBy` are nullable to support historical records | ⚠️ | `prisma/schema.prisma` | `approvedBy String?` exists and is nullable. `triggeredBy` field is entirely absent from `AgentRun`. |

---

## Section 4.8 — Sign-In Page UI

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| 4.8.1 | Sign-in page: `bg-zinc-950` background | ✅ | `app/login/page.tsx` | `bg-zinc-950 min-h-screen` applied. |
| 4.8.2 | Kobani logo and wordmark centered above the button | ✅ | `app/login/page.tsx` | `<Image src="/logo.png">` + wordmark text centered above the button. |
| 4.8.3 | Single primary button: "Sign in with GitHub" with GitHub mark icon | ⚠️ | `app/_components/GitHubSignInButton.tsx` | GitHub mark SVG is included. Button label reads "Continue with GitHub" (not "Sign in with GitHub" as specified). Minor wording divergence. |
| 4.8.4 | No registration link, no password field, no "forgot password" | ✅ | `app/login/page.tsx` | None of these elements are present. |
| 4.8.5 | One-line description: "Sign in to access your team's Kobani board." | ⚠️ | `app/login/page.tsx` | Visible description reads "Your AI-powered workspace" (not the PRD-mandated copy). |
| 4.8.6 | Access-denied page (`/auth/denied`): same dark background and logo | ❌ | — | `app/unauthorized/page.tsx` does not exist on disk. |
| 4.8.7 | Access-denied message: "Access restricted. Contact your team admin to request access." — must not name GitHub, OAuth, or whitelist | ❌ | — | Page does not exist. |
| 4.8.8 | Access-denied page: generic "Sign in" link back to `/auth/signin`; no provider-revealing text | ❌ | — | Page does not exist. |
| 4.8.9 | Rejected username must not appear in URL, query params, or visible text; denial state via short-lived `HttpOnly` cookie | ❌ | `auth.ts` | Auth.js currently surfaces the denial as `?error=AccessDenied` on the configured error page URL — the error type is in the URL. No `HttpOnly` short-lived cookie is set. This is a PRD §4.8 and §6.4 requirement. |

---

## Section 6 — Security Requirements

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| 6.1 | Session cookie: signed + encrypted, `HttpOnly`, `SameSite=Lax`, `Secure` in production; must not store OAuth access token | ✅ | `auth.ts` | JWT strategy via Auth.js. Only `githubUsername` and `avatarUrl` are stored — no OAuth token in session. |
| 6.2 | OAuth `state` parameter: cryptographically random, stored in short-lived cookie, verified on callback; mismatch aborts with error redirect | ✅ | `auth.ts`, `app/api/auth/[...nextauth]/route.ts` | Auth.js handles state/PKCE natively; mismatch redirects to the configured error page. |
| 6.3 | `callbackUrl` validated to allow only same-origin relative paths; validation applied in application code before passing to Auth.js | ✅ | `middleware.ts`, `app/login/page.tsx` | Both layers apply the `startsWith('/') && !startsWith('//')` guard. |
| 6.4 | `/auth/denied` and error responses must not reveal OAuth provider, mechanism, or whitelist; rejected username must not appear in URL or page | ❌ | — | `/unauthorized` page is unbuilt. `?error=AccessDenied` appears in the URL when Auth.js redirects — this confirms authentication is in use. No `HttpOnly` denial cookie mechanism implemented. |
| 6.5 | Unauthenticated API: 401 `{ "error": "Unauthorized" }`. Expired session: 401. UI routes: redirect to `/auth/signin?callbackUrl=...`. No 403 in normal operation. | ✅ | `middleware.ts`, all API route handlers | API returns 401 JSON. Browser routes redirect to `/login?callbackUrl=`. Note: PRD says redirect to `/auth/signin`; implementation uses `/login`. |
| 6.6 | `AUTH_SECRET` in env var, never in source control; `.env.example` documents `AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | ❌ | `.env.example` | `.env.example` does not include `AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_GITHUB_USERS`, or `NEXTAUTH_URL`. All five required variables are missing from the example file. |
| 6.7 | Auth.js v5 used; whitelist check in `signIn` callback; middleware uses `authorized` callback only to verify JWT presence | ✅ | `auth.ts`, `middleware.ts` | Auth.js v5 (`next-auth`) used. Whitelist is in `signIn` callback. Middleware checks `req.auth` (JWT presence) only. |

---

## Section 7 — Environment Variables

| Variable | Status | Implementing file(s) | Notes |
|---|---|---|---|
| `GITHUB_CLIENT_ID` | ❌ | `.env.example` | Missing from `.env.example`. |
| `GITHUB_CLIENT_SECRET` | ❌ | `.env.example` | Missing from `.env.example`. |
| `ALLOWED_GITHUB_USERS` | ❌ | `.env.example` | Missing from `.env.example`. |
| `AUTH_SECRET` | ❌ | `.env.example` | Missing from `.env.example`. |
| `NEXTAUTH_URL` | ❌ | `.env.example` | Missing from `.env.example`. |

---

## SSE `withCredentials` (Open Question 6)

| # | Requirement | Status | Implementing file(s) | Notes |
|---|---|---|---|---|
| OQ6 | `useEventSource` hook must use `withCredentials: true`; must handle 401 on reconnect by redirecting to sign-in rather than looping | ❌ | — | No `useEventSource` hook exists in the codebase. The SSE `EventSource` calls in `app/boards/[id]/_components/AgentOutputPanel.tsx` (or equivalent) need to be reviewed. Neither `withCredentials` nor the 401-redirect-on-reconnect behavior is implemented. |

---

## Gap Summary — PRD Requirements NOT Covered by the Implementation

The following requirements are either entirely absent or critically incomplete. These are the gaps to flag before ship.

### Critical gaps (security / correctness)

1. **`/auth/denied` and `/unauthorized/page.tsx` do not exist.** Auth.js redirects denied users to `/unauthorized` (the configured error page), but that page is not built. Users see a Next.js 404 or unhandled error.

2. **`AgentRun.triggeredBy` is missing from the DB schema and move route.** The Prisma `AgentRun` model has no `triggeredBy` field. `POST /api/cards/:id/move` does not write the authenticated user's identity to the agent run record. This is the core audit-log requirement (§4.7.1–4.7.2).

3. **`.env.example` is missing all five auth variables.** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_GITHUB_USERS`, `AUTH_SECRET`, and `NEXTAUTH_URL` are not documented in `.env.example`, violating §6.6 and §7.

4. **Denied-user URL leaks `?error=AccessDenied`.** Auth.js appends `?error=AccessDenied` to the error page URL, confirming to an observer that authentication was attempted and that it requires a specific provider flow. The PRD (§4.8.9, §6.4) requires passing denial state via a short-lived `HttpOnly` cookie so the username and auth mechanism are not exposed in URLs or browser history.

5. **Rate limiting is not implemented.** No platform-level or edge-level rate limiting on `/api/auth/signin` or `/api/auth/callback/github` (§4.6.1–4.6.2). Must be configured in deployment infrastructure (Vercel/Cloudflare); it is not a code artifact, but it is a hard requirement before any internet-facing deployment.

6. **`UserMenu` is a hardcoded stub.** The real avatar/dropdown/sign-out UI is not built. Sign-out is therefore inaccessible from the UI (§4.4.1–4.4.2).

### Moderate gaps (spec compliance / UX)

7. **Route paths diverge from PRD.** The PRD mandates `/auth/signin` and `/auth/denied`; the implementation uses `/login` and `/unauthorized`. This affects all links, redirects, middleware exclusions, and the public-route table in §4.5.

8. **`ALLOWED_GITHUB_USERS` startup check is lazy, not eager.** The validation runs at first sign-in attempt, not at server startup. An empty or unset variable will produce a 500 at sign-in time rather than a visible startup error (§4.2.4).

9. **Sign-in page copy does not match PRD.** Button label is "Continue with GitHub" (spec: "Sign in with GitHub"). Description is "Your AI-powered workspace" (spec: "Sign in to access your team's Kobani board.") (§4.8.3, §4.8.5).

10. **`GET /api/events/:cardId` has no in-handler auth guard.** It relies solely on middleware. All other API routes have a defense-in-depth `auth()` call. This is inconsistent and leaves the SSE stream unguarded if middleware config is modified (§4.5.8).

11. **SSE `withCredentials: true` not set.** The `EventSource` hook does not yet exist with credential support, and the 401-on-reconnect redirect behavior is not implemented (PRD Open Question 6).
