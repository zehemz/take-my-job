# Security Review — Kobani Auth Design

**Reviewer:** Adversarial security review  
**Date:** 2026-04-13  
**Documents reviewed:** PRD.md, TECH_SPEC.md, DESIGN.md  
**Code reviewed:** `lib/api-types.ts`, `app/api/boards/route.ts`, `app/api/boards/[id]/route.ts`, `app/api/boards/[id]/cards/route.ts`, `app/api/cards/[id]/route.ts`, `app/api/cards/[id]/move/route.ts`, `app/api/events/[cardId]/route.ts`, `middleware.ts` (missing — see Finding 4.1)

---

## Executive Summary

The design is conceptually sound for a team-internal tool, but has **three Critical findings and two High findings** that must be resolved before shipping. The most urgent issues are: (1) `middleware.ts` does not exist yet — every API route is currently fully unauthenticated in production; (2) the SSE endpoint will be bypassed by `EventSource` in cross-origin and some same-origin configurations that do not send cookies; and (3) the session lifetime in the TECH_SPEC (30 days) contradicts the PRD (7 days), with the longer value creating a meaningful revocation window that is not acknowledged. All six API route files read during this review contain zero authentication logic.

---

## Finding 1 — OAuth Flow Security

### 1.1 State Parameter CSRF Protection
**Severity: Low (delegated to Auth.js)**

Auth.js v5 generates the `state` parameter automatically and stores it in a short-lived signed cookie before redirecting to GitHub. The verification on callback is built into the library. This is correct.

One real risk: the PRD's custom `app/auth/callback/route.ts` in the DESIGN.md component table implies a hand-rolled callback handler. The TECH_SPEC section 7 uses Auth.js's `[...nextauth]/route.ts` catch-all handler instead. **These two documents contradict each other.** If someone implements the DESIGN.md version (a custom route handler at `app/auth/callback/route.ts`) rather than the TECH_SPEC version, they will be writing the OAuth callback from scratch, losing all of Auth.js's built-in state verification.

**Recommendation:** Delete the `app/auth/callback/route.ts` row from DESIGN.md's component table. Explicitly state in DESIGN.md that the callback is handled by Auth.js, not custom code.

### 1.2 Redirect URI Validation
**Severity: Medium**

The design delegates redirect URI validation to GitHub's OAuth App registration and to Auth.js's built-in callback URL enforcement. This is correct in principle. However, the TECH_SPEC does not specify whether `NEXTAUTH_URL` is validated at startup. If `NEXTAUTH_URL` is unset in production, Auth.js v5 falls back to inferring the base URL from request headers (`x-forwarded-host`, `host`). In a deployment behind a reverse proxy (Vercel, Fly.io, etc.), a malicious `x-forwarded-host` header from a compromised upstream could cause Auth.js to generate callback URLs pointing at attacker-controlled domains, which GitHub would reject — but the error handling would redirect to an unexpected location.

**Recommendation:** Treat `NEXTAUTH_URL` as required in production (the PRD already lists it as required). Add a startup assertion that exits if `NEXTAUTH_URL` is unset in `NODE_ENV=production`. Do not rely on header inference.

### 1.3 Authorization Code Interception
**Severity: Low (acceptable)**

PKCE is recommended for public OAuth clients but is optional for confidential clients (server-side). Auth.js v5 with a server-side GitHub provider uses the confidential client model — the `client_secret` never leaves the server. Authorization codes are single-use and short-lived (10 minutes per GitHub's docs). The redirect URI is pinned to the registered callback. This is acceptable.

---

## Finding 2 — JWT Session Security

### 2.1 Algorithm and Secret Strength
**Severity: Medium**

Auth.js v5 uses JWE (JSON Web Encryption) with A256CBC-HS512 by default, using `AUTH_SECRET` as key material. The PRD correctly requires a minimum of 32 random bytes (`openssl rand -hex 32` produces 32 bytes of entropy encoded as 64 hex chars — this is fine). The TECH_SPEC example comment says `openssl rand -base64 32`, which produces 24 bytes of raw entropy (32 base64 chars decode to 24 bytes). **24 bytes is below the 32-byte minimum the PRD specifies.**

**Recommendation:** Standardize on `openssl rand -hex 32` across all documentation. Update the TECH_SPEC section 3 comment and the `.env.example` entry. Both PRD and TECH_SPEC must agree on the generation command.

### 2.2 Session Lifetime Discrepancy
**Severity: High**

The PRD (section 4.3) specifies a **7-day** session lifetime. The TECH_SPEC (section 11) states Auth.js's default of **30 days**. These are not reconciled anywhere. Auth.js v5's default `maxAge` is 30 days unless explicitly set. If the implementation uses the library default, sessions live 30 days, directly contradicting the stated security posture.

This matters for the revocation model: a removed user with a 30-day session who was removed on day 1 has 29 days of continued access to any routes that do not re-check the whitelist at request time — and this design deliberately avoids per-request whitelist checks.

**Recommendation:** Explicitly set `session: { maxAge: 7 * 24 * 60 * 60 }` in `auth.ts`. Document this in the TECH_SPEC. Do not rely on library defaults.

### 2.3 Session Theft and Replay After Logout
**Severity: Medium**

Sessions are stateless (no server-side store). Sign-out clears the cookie on the client, but if an attacker has already exfiltrated the session cookie (via XSS, network interception on HTTP, or physical device access), the stolen cookie remains cryptographically valid until expiry. There is no server-side revocation mechanism for individual sessions — only the blunt `AUTH_SECRET` rotation that logs out everyone.

This is a known and documented tradeoff of stateless JWT sessions. The design acknowledges it. For a team-internal tool this is acceptable, but it must be stated explicitly rather than implied.

**Recommendation:** Document in the TECH_SPEC that individual session revocation is not supported in v1. Add a note that `AUTH_SECRET` rotation is the only revocation mechanism, and that it affects all sessions. Flag this as a v2 candidate if the tool is ever deployed with more sensitive data.

---

## Finding 3 — Whitelist Bypass Vectors

### 3.1 Case Sensitivity
**Severity: Low (handled correctly)**

The whitelist comparison lowercases both sides: `profile.login.toLowerCase()` vs `u.trim().toLowerCase()`. GitHub login names are case-insensitive at GitHub's own layer, so this is correct. No bypass vector here.

### 3.2 Unicode and Homoglyph Usernames
**Severity: Low (mitigated by GitHub)**

GitHub enforces ASCII-only usernames (letters, digits, hyphens; no Unicode). Homoglyph attacks at the GitHub account layer are not possible. The comparison is safe.

However: `profile.login` comes from GitHub's API response. The design does not validate that `profile.login` matches the expected format (alphanumeric + hyphens, 1-39 chars) before the `.toLowerCase()` call and whitelist lookup. A malformed or null value could cause unexpected behavior. The TECH_SPEC's `signIn` callback already handles the null case (`if (!githubUsername) return false`), which is correct.

**Recommendation:** Add a regex check on `profile.login` before the whitelist comparison: `/^[a-z0-9-]{1,39}$/i`. This is defense in depth — it prevents a hypothetically unexpected GitHub API response from causing a whitelist bypass.

### 3.3 Empty or Unset ALLOWED_GITHUB_USERS
**Severity: Critical (if not implemented correctly)**

The PRD (section 4.2) states: "If `ALLOWED_GITHUB_USERS` is not set or is empty, the app refuses to start (dev) or returns 503 (production)."

The TECH_SPEC's `auth.ts` code does NOT implement this behavior. The code is:

```typescript
const allowedUsers = (process.env.ALLOWED_GITHUB_USERS ?? '')
  .split(',')
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);
```

When `ALLOWED_GITHUB_USERS` is unset, this produces an empty array (`[]`). The `signIn` callback then does `allowedUsers.includes(githubUsername)`, which returns `false` for every user. This means an empty/unset variable silently blocks everyone — it does not open access. **This is actually fail-closed, which is the safe behavior.**

However, the PRD also says "the app refuses to start." The TECH_SPEC code does not implement a startup check. A deployment where `ALLOWED_GITHUB_USERS` is accidentally cleared will silently deny all logins with no error message, no alerting, and no log distinguishing "no whitelist configured" from "user not on whitelist." The outage is invisible until users complain.

Furthermore, `allowedUsers` is computed at module load time in the TECH_SPEC's `auth.ts`. If the variable is set after the module is loaded (e.g., via hot module replacement in development), the computed value will be stale.

**Recommendation:**
1. Add a startup check in `auth.ts` (or in a separate `lib/config.ts` loaded at startup):
   ```typescript
   if (!process.env.ALLOWED_GITHUB_USERS?.trim()) {
     throw new Error('ALLOWED_GITHUB_USERS is not set. Set it to a comma-separated list of GitHub usernames.');
   }
   ```
2. Move the `allowedUsers` computation inside the `signIn` callback (read `process.env` fresh on each sign-in) rather than at module load time. This avoids the stale-value problem and makes the startup check the only place that enforces the variable's presence.

---

## Finding 4 — API Route Protection Gaps

### 4.1 middleware.ts Does Not Exist
**Severity: Critical**

`middleware.ts` is not present in the repository. Every API route is currently unauthenticated. The code reviewed confirms this: all six API route files (`app/api/boards/route.ts`, `app/api/boards/[id]/route.ts`, `app/api/boards/[id]/cards/route.ts`, `app/api/cards/[id]/route.ts`, `app/api/cards/[id]/move/route.ts`, `app/api/events/[cardId]/route.ts`) have zero authentication logic. Anyone on the network can trigger agent runs and burn API credits right now.

**Recommendation:** Implementing the middleware and the per-route `auth()` guards is a prerequisite for any deployment beyond localhost. This is not a design flaw — it is an unimplemented requirement.

### 4.2 SSE Endpoint Cookie Delivery
**Severity: Critical**

`GET /api/events/[cardId]` is consumed via the browser's `EventSource` API. The `EventSource` API **does not send credentials (cookies) by default**. The default behavior is `new EventSource(url)` with `withCredentials: false`. In this mode, the browser omits the session cookie entirely.

This means the middleware session check on the SSE route will always see "no session cookie" and redirect to `/login` — but `EventSource` does not follow redirects in any useful way; it reconnects and retries, entering an infinite redirect loop. Alternatively, if the middleware is configured to allow the SSE endpoint to pass through (to avoid the loop), the endpoint is unprotected.

The PRD (Open Question 6) acknowledges this: "The `useEventSource` hook should handle 401 responses by redirecting the user to the sign-in page rather than entering an infinite retry loop." But this treats the symptom, not the cause.

The correct fix is to instantiate `EventSource` with `withCredentials: true`:
```javascript
new EventSource('/api/events/' + cardId, { withCredentials: true })
```

This causes the browser to send cookies with the SSE request, allowing the middleware session check to work. This works for same-origin requests (which this is). However, `withCredentials` behavior differs across browsers in some edge cases, and it must be explicitly set — it is not the default.

Even with `withCredentials: true`, if the session expires mid-stream, the server has already returned 200 and opened the stream. The server cannot retroactively reject the connection once streaming has started. The SSE connection will stay open until the client disconnects or the server closes it. This means a session expiry does not terminate an active SSE connection — only new connections are blocked.

**Recommendation:**
1. Ensure the `useEventSource` hook uses `withCredentials: true`.
2. Add a per-route `auth()` check at the top of `app/api/events/[cardId]/route.ts` as defense in depth (the TECH_SPEC already recommends this but it is not implemented).
3. Document the "session expiry does not kill active streams" behavior as a known limitation.

### 4.3 Middleware Matcher Pattern Has Bypass Potential
**Severity: High**

The TECH_SPEC middleware matcher is:

```javascript
'/((?!login|unauthorized|api/auth|_next/static|_next/image|favicon|icon|apple-icon).*)'
```

This pattern does not anchor exclusions to the start of the path segment correctly. The pattern `(?!login|...)` matches anywhere in the URL path component processed after the leading `/`. However, the specific risk is:

**The pattern excludes `icon` but this would also exclude any path containing the substring `icon`** — for example, a hypothetical future route `/api/icons/...` would be inadvertently excluded from middleware protection. More concretely, `favicon` without a word boundary would match `/api/favicon-data` or similar.

Additionally, the pattern excludes `unauthorized` as a bare string, meaning a path like `/api/unauthorized-action` would also bypass middleware. This is not a current route but is a latent trap.

The PRD's route table uses `/auth/signin` and `/auth/denied`, but the TECH_SPEC/DESIGN uses `/login` and `/unauthorized` as the actual paths. The middleware exclusion is therefore correct for the implemented paths, but the inconsistency between documents increases the chance of an error during implementation.

**Recommendation:**
1. Use anchored path exclusions: `^/login`, `^/unauthorized`, `^/api/auth/` instead of bare substrings.
2. Resolve the path inconsistency: the PRD says `/auth/signin` and `/auth/denied`; the TECH_SPEC implements `/login` and `/unauthorized`. Pick one and update all documents.
3. Consider a positive-list matcher (explicitly list protected path prefixes) rather than a negative-list matcher (exclude public paths). Negative lists grow as the app grows and are easy to misconfigure.

### 4.4 No Defense-in-Depth Auth Checks in Route Handlers
**Severity: High**

The TECH_SPEC (section 12) explicitly recommends adding `auth()` guards to every route handler as defense in depth. None of the six route files implement this. The middleware is described as "sufficient for browser-originated requests" but the spec acknowledges that direct `curl`/programmatic calls that do not follow redirects bypass it.

In practice: if `middleware.ts` has a matcher bug, is misconfigured, or is absent (as it is today), there is no secondary check. A single layer of protection on a route that spawns Anthropic API calls is insufficient.

**Recommendation:** Add `const session = await auth(); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });` to every handler as a non-negotiable implementation step, not an optional enhancement. This is especially critical for `POST /api/cards/[id]/move` (agent run trigger) and `POST /api/boards/[id]/cards`.

---

## Finding 5 — The "Deploy = Revocation" Model

### 5.1 Revocation Window
**Severity: Medium**

The design treats deploy completion as the revocation event. In a real CI/CD pipeline (e.g., Vercel or Fly.io), the actual window between "admin removes username from env var" and "new instance handling all traffic" is:

- **Vercel:** Typically 1-3 minutes for build + deployment, but the old deployment continues to handle requests until the new one passes health checks and traffic is shifted. During blue/green cutover, the old instance may handle requests for an additional 30-60 seconds. Total window: ~2-5 minutes.
- **Fly.io with rolling deploy:** New VMs come up one by one. Old VMs stay alive and handle requests until new ones are healthy. With a 3-VM setup this can be 3-5 minutes.
- **Manual `fly deploy` failure or Vercel build failure:** If the deploy fails, the old instance (with the old whitelist containing the removed user) remains the sole running instance indefinitely. The removed user retains access until the next successful deploy.

This window is acceptable for most team-internal use cases, but the PRD does not quantify it. The operational assumption ("redeploy = instant revocation") is incorrect for production deployments.

**Recommendation:**
1. Document the realistic revocation window (2-10 minutes depending on platform).
2. Make explicit that a failed deploy means the whitelist change did not take effect, and the admin must retry.
3. Acknowledge that `AUTH_SECRET` rotation is the only immediate revocation mechanism.

---

## Finding 6 — AUTH_SECRET Rotation as Emergency Revocation

### 6.1 Does It Actually Work Immediately?
**Severity: Medium**

Rotating `AUTH_SECRET` and redeploying invalidates all JWTs because the signature/encryption key changes. This is correct in principle. However:

**Caching risk:** Next.js in production mode does not cache `process.env` in a way that would cause stale secret reads after a deploy — a redeploy restarts the process. However, if the deployment uses a platform with warm starts or process reuse between requests (certain Vercel edge runtime configurations), there is a window where old processes serve with the old secret and new processes serve with the new secret. During this window, sessions signed with the old secret may still validate on old processes.

**The secret rotation requires a redeploy.** The steps documented in TECH_SPEC section 11 correctly include "redeploy" as step 3. However, if the admin rotates `AUTH_SECRET` in the deployment environment *without* triggering a redeploy (possible on Vercel by updating an env var without triggering a build), the running process continues using the old secret from its startup environment snapshot. On Vercel, environment variable changes do not hot-reload running functions — a redeploy or restart is explicitly required.

**Recommendation:** Add explicit documentation: "Updating `AUTH_SECRET` in the deployment dashboard does NOT invalidate active sessions until the next deployment. You must trigger a redeploy after updating the secret."

---

## Finding 7 — Session Fixation and Account Takeover

### 7.1 GitHub Account Rename Breaking Whitelist
**Severity: Medium**

Acknowledged in DESIGN.md section 6f as expected behavior. The whitelist entry for the old username becomes orphaned. The user loses access on their next sign-in attempt. This is correct behavior, not a security flaw.

However: the user's **existing session** was created with `githubUsername` set to their old login. That session remains valid until expiry. If the session is used to identify the actor (e.g., for `approvedBy` attribution), the stored username in historical records will be the old handle. This is a data integrity concern, not a security vulnerability.

### 7.2 OAuth Token Scope
**Severity: Low**

The design correctly requests only `read:user` scope. The DESIGN.md section 2b confirms this. The OAuth token is not stored in the session cookie — only the derived username and avatar URL are. This is the minimum viable scope. No finding here beyond confirming it is correct.

### 7.3 Two GitHub Users With Similar Usernames
**Severity: Low**

GitHub enforces uniqueness of login names. Two users cannot have the same login. This is not a realistic attack vector.

### 7.4 approvedBy Field Is a Free-Form String
**Severity: Medium**

`UpdateCardRequest.approvedBy` is a free-form string field in `lib/api-types.ts`. The TECH_SPEC notes that after auth is added, "the UI should automatically pass `session.user.githubUsername`." However, the API itself does not enforce this — a raw `PATCH /api/cards/:id` with `{ "approvedBy": "attacker" }` would set `approvedBy` to any arbitrary value. Any audit trail built on this field is falsifiable.

This is a pre-existing design issue, not introduced by the auth feature. But since the auth design explicitly calls out `approvedBy` as mapping to `githubUsername` for accountability purposes, the field needs server-side enforcement.

**Recommendation:** In the `PATCH /api/cards/[id]` handler, after auth is added, if `approvedBy` is present in the request body, ignore it and instead set `approvedBy = session.user.githubUsername` from the authenticated session. Never trust client-supplied identity claims.

---

## Finding 8 — Information Disclosure

### 8.1 Unauthorized Page Reveals App Identity
**Severity: Low (acceptable)**

The `/auth/denied` page confirms: (a) the application exists, (b) it uses GitHub OAuth for authentication, (c) access is controlled by a whitelist. This is a minor information disclosure. For a team-internal tool this is acceptable — security through obscurity is not a defense.

### 8.2 Rejected Username in URL Query Parameter
**Severity: Medium**

The DESIGN.md section 2d passes the rejected GitHub username as a query parameter: `/auth/denied?username=<login>`. This username then appears in:
- Server access logs
- Browser history
- Referrer headers if the page contains any external resources (images, fonts, analytics)
- Any third-party monitoring tools capturing URL parameters

For a team-internal tool this is low risk. However, the username is data about a person. If the app ever collects any analytics (e.g., Vercel Analytics, which is on by default), the rejected username will be captured.

**Recommendation:** Either (a) pass the username in a session flash cookie rather than a URL parameter, or (b) explicitly confirm that no analytics are capturing URL parameters in the deployment environment. If the username is only needed for display, reading it from the OAuth error context rather than a URL param is cleaner.

### 8.3 Error Code Exposure on Sign-in Page
**Severity: Low**

The sign-in page renders different error messages based on the `?error=` query parameter from Auth.js. Auth.js's built-in error codes (`OAuthCallback`, `OAuthSignin`, `AccessDenied`, etc.) are exposed to any observer. This is standard behavior and acceptable.

---

## Finding 9 — Next.js-Specific Risks

### 9.1 Middleware Runs on Edge Runtime — No Node.js Crypto
**Severity: Low (handled by Auth.js)**

Next.js middleware runs on the Edge runtime by default, which does not have access to Node.js's `crypto` module. Auth.js v5 is specifically designed for the Edge runtime and uses the Web Crypto API (`SubtleCrypto`) for JWT verification. This is handled correctly by the library.

However, if the TECH_SPEC's future "defense-in-depth" recommendation leads someone to add custom crypto in the middleware (e.g., manually verifying a JWT), they would need to use `SubtleCrypto` rather than `crypto.createHmac`. The spec should note this constraint to prevent a future implementation error.

### 9.2 Server Action in Login Page — CSRF Exposure
**Severity: Medium**

The TECH_SPEC's `app/login/page.tsx` uses a Next.js server action:

```typescript
action={async () => {
  'use server';
  await signIn('github', { redirectTo: searchParams.callbackUrl ?? '/' });
}}
```

Server actions in Next.js 14 App Router use POST requests with an `x-action` header and are protected by Next.js's built-in CSRF token mechanism (via the `next-action` header validation). This is correct.

However, `searchParams.callbackUrl` is passed directly from the URL to `signIn`'s `redirectTo` parameter. Auth.js validates that `redirectTo` is a relative URL before the final redirect, but a malicious `callbackUrl` value (e.g., `javascript:alert(1)` or `//evil.com`) would be passed to Auth.js and Auth.js must be relied upon to catch it. The validation should be explicit in application code, not delegated entirely to the library.

**Recommendation:** Validate `callbackUrl` before passing it to `signIn`:
```typescript
const safeCb = searchParams.callbackUrl;
const isRelative = safeCb && safeCb.startsWith('/') && !safeCb.startsWith('//');
await signIn('github', { redirectTo: isRelative ? safeCb : '/' });
```

### 9.3 App Router vs Pages Router Session Handling
**Severity: Low**

The project uses App Router exclusively. Auth.js v5 is designed for App Router. There is no Pages Router in play. No finding here.

### 9.4 SessionProvider Exposes Session to Client Components
**Severity: Low (by design)**

Wrapping the entire app in `AuthSessionProvider` exposes session data (including `githubUsername` and `avatarUrl`) to all client components via `useSession()`. The session data is already in the cookie — this does not increase the attack surface. However, XSS anywhere in the app can call `getSession()` and exfiltrate the session object. The `HttpOnly` cookie flag prevents direct cookie theft via XSS, but the session contents are accessible through the `useSession()` hook from any client component in an XSS context.

**Recommendation:** Do not store any sensitive data (OAuth tokens, emails, admin flags) in the session object. The current design (username + avatar URL) is appropriate minimal data.

---

## Finding 10 — Missing Controls

### 10.1 No Rate Limiting on Sign-in Endpoint
**Severity: High**

`/api/auth/signin` (and the OAuth callback at `/api/auth/callback/github`) are unprotected against automated abuse. An attacker can:

1. Enumerate GitHub usernames in the whitelist by repeatedly initiating OAuth flows and observing whether they land on `/auth/denied` or the board. This leaks the whitelist members.
2. Trigger repeated OAuth round-trips to GitHub's servers, which may have implications for the app's OAuth App rate limits.

There is no brute-force protection, no CAPTCHA, no IP-based throttling, and no lockout mechanism.

For a team-internal tool this is lower risk than for a public app. However, the username enumeration attack (finding whitelist members) is a real concern if the app is internet-facing.

**Recommendation:**
1. Deploy behind Vercel's edge rate limiting, Cloudflare, or a WAF for production. Do not implement rate limiting in application code for v1 — platform-level controls are more robust.
2. For username enumeration specifically: consider adding a deliberate delay (same artificial latency for allowed and denied callbacks) to make timing attacks harder.

### 10.2 No Audit Logging of Agent Run Triggers
**Severity: Medium**

The PRD (Open Question 5) asks whether card moves should record the GitHub username. The answer is yes — without it, there is no way to attribute API cost to a specific user. Currently, `POST /api/cards/[id]/move` writes nothing about who triggered the move. After auth is added, the authenticated username is available from the session and should be written to the `AgentRun` record.

**Recommendation:** Add `triggeredBy: string | null` to the `AgentRun` model. Populate it from `session.user.githubUsername` in the move handler. This is low-effort and high-value for cost attribution and incident investigation.

### 10.3 No MFA Enforcement
**Severity: Low (acceptable)**

The PRD explicitly non-goals MFA beyond what GitHub provides. GitHub's own 2FA enforcement is configurable per organization. If the GitHub organization backing these accounts requires 2FA, MFA is effectively enforced. This is acceptable for v1.

---

## Summary of Findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 4.1 | `middleware.ts` does not exist — all routes are unprotected | Critical | Not implemented |
| 4.2 | SSE endpoint bypassed by `EventSource` without `withCredentials: true` | Critical | Not implemented |
| 3.3 | `ALLOWED_GITHUB_USERS` empty/unset has no startup check, stale module-level read | Critical | Not implemented |
| 2.2 | Session lifetime discrepancy: PRD says 7 days, TECH_SPEC defaults to 30 days | High | Design gap |
| 4.3 | Middleware matcher uses unsafe substring exclusions; path naming inconsistency | High | Design gap |
| 4.4 | No defense-in-depth `auth()` checks in any route handler | High | Not implemented |
| 10.1 | No rate limiting on sign-in; whitelist enumeration possible | High | Not implemented |
| 1.2 | `NEXTAUTH_URL` not validated at startup; header-injection callback URL risk | Medium | Design gap |
| 2.1 | Secret strength example (`openssl rand -base64 32`) generates only 24 bytes | Medium | Documentation error |
| 2.3 | Stateless sessions: no individual session revocation; stolen cookie valid until expiry | Medium | Known tradeoff, not documented |
| 5.1 | Revocation window (2-10 min) not quantified; failed deploy leaves old whitelist live | Medium | Documentation gap |
| 6.1 | Rotating `AUTH_SECRET` in dashboard without redeploy does not invalidate sessions | Medium | Documentation gap |
| 7.4 | `approvedBy` is client-supplied; API does not enforce it matches authenticated user | Medium | Design flaw |
| 8.2 | Rejected username in URL query param; logged by analytics, browser history, referrers | Medium | Design choice |
| 9.2 | `callbackUrl` from `searchParams` passed to `signIn` without app-level validation | Medium | Design gap |
| 10.2 | No audit log of who triggered agent runs; no cost attribution | Medium | Missing feature |
| 1.1 | DESIGN.md and TECH_SPEC contradict on whether callback is custom or Auth.js | Low | Documentation conflict |
| 3.2 | `profile.login` not validated against expected format before whitelist check | Low | Defense in depth gap |
| 7.1 | GitHub account rename leaves stale `approvedBy` attribution in historical records | Low | Known limitation |
| 9.1 | Edge runtime constraint on crypto not documented; risk if custom crypto added later | Low | Documentation gap |
| 9.4 | Session contents accessible via `useSession()` in XSS context | Low | Acceptable for current data |
| 10.3 | No MFA enforcement beyond GitHub | Low | Accepted non-goal |

---

## Verdict

**Not secure enough to ship as-is — must fix the following before any non-localhost deployment:**

1. **Implement `middleware.ts`** — the entire point of this feature does not exist yet.
2. **Add per-route `auth()` guards to all route handlers** — especially `POST /api/cards/[id]/move`. Middleware alone is insufficient defense.
3. **Fix `withCredentials: true` on `EventSource`** — without this, the SSE route is either perpetually blocked or perpetually unprotected.
4. **Add a startup validation check for `ALLOWED_GITHUB_USERS`** — and move the whitelist parsing inside the `signIn` callback to avoid stale module-level state.
5. **Reconcile session lifetime** — explicitly set `maxAge: 7 * 24 * 60 * 60` in `auth.ts`; do not inherit the 30-day default.
6. **Fix the middleware matcher** — use anchored patterns and resolve the `/auth/signin` vs `/login` naming inconsistency across all documents.
7. **Validate `callbackUrl` explicitly** in the server action before passing it to `signIn`.
8. **Fix the `approvedBy` field** — server must ignore client-supplied value and set it from the authenticated session.
9. **Correct the secret generation example** — use `openssl rand -hex 32` everywhere.

Items 1-6 are blockers. Items 7-9 are pre-ship requirements but can be done in parallel with implementation. All medium and low findings should be addressed within the first iteration after initial ship.
