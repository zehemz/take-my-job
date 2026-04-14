# Security Sign-Off — Kobani GitHub OAuth Auth

**Reviewer:** Security engineer final sign-off
**Date:** 2026-04-13
**Implementation reviewed:**
- `auth.ts` — NextAuth config
- `middleware.ts` — route protection
- `app/api/boards/route.ts` — protected API route example
- `app/api/cards/[id]/route.ts` — PATCH with approvedBy fix
- `app/api/cards/[id]/move/route.ts` — highest-risk route
- `app/api/events/[cardId]/route.ts` — SSE endpoint
- `app/login/page.tsx` — sign-in page
- `app/unauthorized/page.tsx` — access denied page
- `types/next-auth.d.ts` — session types
- `.env.example` — documented variables

Original findings source: `docs/features/auth/SECURITY_REVIEW.md`

---

## Finding-by-Finding Checklist

### Finding 1 — middleware.ts missing (Critical)

**Original finding (4.1):** `middleware.ts` did not exist. Every API route was fully unauthenticated. Anyone on the network could trigger agent runs.

**Status: ✅ Fixed**

`middleware.ts` now exists and is correct. It wraps Auth.js's `auth()` as the middleware function, giving every matched request a session check before the route handler runs. API routes receive a `401 JSON` response on missing session; browser routes receive a redirect to `/login` with a validated `callbackUrl`. The matcher pattern (see Finding 5) is also addressed.

---

### Finding 2 — SSE endpoint cookie delivery / withCredentials (Critical)

**Original finding (4.2):** `GET /api/events/[cardId]` would be consumed by the browser's `EventSource` API without `withCredentials: true`, meaning cookies are never sent, causing either an infinite redirect loop or an unprotected endpoint.

**Status: ⚠️ Partial**

**What is done:**
- The server-side route (`app/api/events/[cardId]/route.ts`) now has a correct `auth()` guard at the top. If no session cookie arrives, it returns `401` rather than opening the stream or redirecting. The server side is safe.

**What remains:**
- No frontend `EventSource` instantiation exists anywhere in the codebase (`app/`, `lib/hooks/`). A grep across all `.ts`/`.tsx` files outside `node_modules` confirms there is no `EventSource` call, no `useEventSource` hook, and no reference to `/api/events` in client code. The `AgentOutputPanel` component receives output as a static prop — it does not open an SSE connection.
- When the frontend SSE client is eventually written it **must** use `withCredentials: true`. Without it, the server-side `auth()` guard will always return `401` and the SSE subscription will never work.
- The `PM_CHECKLIST.md` documents this as open question OQ6 and explicitly marks it not implemented.

**Remaining blocker:** The SSE consumer does not exist yet. The server is protected, but the feature is non-functional. Before the SSE integration is written, it must use `new EventSource(url, { withCredentials: true })`. This must be a hard requirement in the implementation ticket, not a post-ship retrofit.

---

### Finding 3 — ALLOWED_GITHUB_USERS startup validation (Critical)

**Original finding (3.3):** No startup check for empty/unset `ALLOWED_GITHUB_USERS`. The whitelist was computed at module load time (stale-value risk). An empty variable silently blocked everyone with no distinguishable error.

**Status: ✅ Fixed**

`auth.ts` implements `getAllowedUsers()` which throws a descriptive `Error` if the parsed list is empty:

```typescript
if (users.length === 0) {
  throw new Error(
    '[kobani] ALLOWED_GITHUB_USERS is not set or empty. ...'
  );
}
```

This function is called inside the `signIn` callback, not at module load time, so it reads `process.env` fresh on every sign-in attempt. This eliminates the stale-module-value risk. The error propagates as a startup failure in practice because Next.js will surface it on the first auth attempt. The `.env.example` documents the variable with a comment: "Empty or unset = startup failure (fail-closed)."

One nuance: the throw occurs on the first sign-in attempt rather than at process startup. A deployment with an unset variable will start the HTTP server without error, but will fail on the first login. This is a known limitation of the Next.js module loading model and is acceptable for v1. The fail-closed guarantee is intact.

---

### Finding 4 — Session lifetime 30-day default (High)

**Original finding (2.2):** PRD specified 7-day sessions; TECH_SPEC defaulted to Auth.js's 30-day `maxAge`. Not reconciled.

**Status: ✅ Fixed**

`auth.ts` explicitly sets:

```typescript
session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }, // 24h — do NOT use 30d default
```

This sets the session lifetime to 24 hours, which is stricter than both the PRD's 7-day target and the TECH_SPEC's 30-day default. The inline comment explicitly calls out the 30-day default as something to avoid. A 24-hour session is an acceptable and conservative choice for a team tool that requires daily authentication, and it reduces the revocation window compared to both previously-specified values.

---

### Finding 5 — Middleware matcher unsafe patterns (High)

**Original finding (4.3):** The TECH_SPEC's matcher used bare substring exclusions (`(?!login|unauthorized|...)`). The unanchored `icon` exclusion could accidentally bypass protection for any future route containing the substring `icon`. The `unauthorized` exclusion could bypass `/api/unauthorized-action`.

**Status: ✅ Fixed**

The implemented matcher uses anchored exclusions:

```javascript
'/((?!login$|unauthorized$|api/auth(?:/|$)|_next/static|_next/image|favicon\\.ico).*)'
```

- `login$` and `unauthorized$` are end-anchored, preventing substring matches against longer paths.
- `api/auth(?:/|$)` uses a non-capturing group to match the path segment precisely, preventing `api/auth-something` from matching.
- `favicon\\.ico` is a specific filename, not a bare `favicon` prefix.
- `icon` (the problematic bare exclusion from the TECH_SPEC) is gone entirely.

The path naming is also consistent: the matcher excludes `login` and `unauthorized`, and `auth.ts` sets `pages: { signIn: '/login', error: '/unauthorized' }`. No inconsistency between documents and implementation.

---

### Finding 6 — No per-route auth() guards (High)

**Original finding (4.4):** Zero authentication logic in any of the six API route files. Middleware alone is insufficient for clients that do not follow redirects (e.g., `curl`, programmatic access). A middleware misconfiguration would leave routes completely unprotected.

**Status: ✅ Fixed**

All reviewed route handlers now include the standard defense-in-depth guard as the first operation:

```typescript
const session = await auth();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

Confirmed in:
- `app/api/boards/route.ts` — GET
- `app/api/cards/[id]/route.ts` — GET, PATCH, DELETE
- `app/api/cards/[id]/move/route.ts` — POST (the highest-risk route)
- `app/api/events/[cardId]/route.ts` — GET

The `401` response for unauthenticated programmatic requests is correct and consistent.

---

### Finding 7 — No rate limiting (High)

**Original finding (10.1):** No brute-force protection or IP-based throttling on `/api/auth/signin`. Whitelist enumeration possible by observing `/auth/denied` vs. board redirect.

**Status: ⚠️ Partial**

**What is done:** Nothing in application code — as the original finding recommended. The SECURITY_REVIEW explicitly stated "do not implement rate limiting in application code for v1 — platform-level controls are more robust."

**What remains:** There is no evidence in the codebase of platform-level rate limiting configuration (Vercel edge rate limiting, Cloudflare, or WAF rules). This is a deployment/infrastructure concern, not an application code concern, so it does not block a code review sign-off. However, it must be confirmed at deployment time before internet-facing exposure.

The username enumeration vector (observing `/auth/denied` vs. successful redirect) remains possible for any unauthenticated attacker who can reach the sign-in endpoint. For an internet-facing deployment of a team-internal tool this is low-risk in practice but non-zero.

**Remaining action (deployment gate, not a code gate):** Confirm platform-level rate limiting is enabled before making the app internet-facing.

---

### Finding 8 — GitHub username case sensitivity (Medium)

**Original finding (3.1/3.2 in review, implied by finding 8 in sign-off brief):** Whitelist comparison must be case-insensitive. `profile.login` must be validated against the expected GitHub username format before the whitelist lookup.

**Status: ✅ Fixed**

`auth.ts` implements both:

1. **Format validation before lookup:**
   ```typescript
   const GITHUB_LOGIN_RE = /^[a-z0-9-]{1,39}$/i;
   // ...
   if (!GITHUB_LOGIN_RE.test(login)) return false;
   ```
   This rejects null, empty, oversized, or malformed `profile.login` values before any comparison.

2. **Case-insensitive comparison:**
   ```typescript
   const users = raw.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
   // ...
   return allowed.has(login.toLowerCase());
   ```
   Both sides are lowercased. `Set.has()` on lowercased values is case-insensitive by construction.

---

### Finding 9 — callbackUrl open-redirect (Medium)

**Original finding (9.2):** `callbackUrl` from `searchParams` was passed directly to `signIn`'s `redirectTo` parameter without app-level validation, relying entirely on Auth.js to catch malicious values like `//evil.com` or `javascript:...`.

**Status: ✅ Fixed**

Validation is now applied in two places, providing defense in depth:

**`app/login/page.tsx`** (server component, runs before rendering):
```typescript
const raw = params.callbackUrl;
const callbackUrl =
  raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
```

**`middleware.ts`** (before setting the `callbackUrl` search param on the redirect):
```typescript
const raw = req.nextUrl.pathname;
const safeCallback = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
loginUrl.searchParams.set('callbackUrl', safeCallback);
```

Both checks enforce the same policy: the value must begin with `/` and must not begin with `//` (which would be interpreted as a protocol-relative URL by browsers). Values that fail validation are replaced with `/`. Auth.js's own validation is an additional third layer.

Note: `GitHubSignInButton.tsx` passes the already-validated `callbackUrl` prop directly to `signIn('github', { callbackUrl })` from `next-auth/react`. Since the value was sanitized upstream in the server component before being passed as a prop, this is correct.

---

### Finding 10 — approvedBy client-supplied (Medium)

**Original finding (7.4):** `PATCH /api/cards/[id]` accepted `approvedBy` from the request body as a free-form string. Any audit trail built on this field was falsifiable.

**Status: ✅ Fixed**

`app/api/cards/[id]/route.ts` PATCH handler ignores the client-supplied value and substitutes the authenticated session identity:

```typescript
...(body.approvedBy !== undefined && {
  approvedBy: session.user.githubUsername, // NEVER trust the client-supplied value
  approvedAt: new Date(),
}),
```

The presence of `body.approvedBy` in the request triggers the server to set `approvedBy`, but the value used is always `session.user.githubUsername` from the validated JWT. A client cannot forge a different approver. The comment in the code makes the intent explicit and guards against future regression.

---

## Additional Observations (not in original 10 findings)

### .env.example — Secret generation command (Finding 2.1 from original review)

**Status: ✅ Fixed**

`.env.example` documents `AUTH_SECRET` generation as:
```
# Auth secret — generate with: openssl rand -hex 32
```
`openssl rand -hex 32` produces 32 bytes of raw entropy (64 hex characters). This is correct and consistent with the PRD's requirement. The original finding noted that the TECH_SPEC used `openssl rand -base64 32` (24 bytes of entropy). The implementation uses the correct command.

### unauthorized page — information disclosure (Finding 8.2 from original review)

**Status: ✅ Fixed (better than required)**

`app/unauthorized/page.tsx` does not include the rejected GitHub username in the URL or in the page body. It shows only a generic "Access denied / Contact your team admin" message with a sign-in link. There is no `?username=` query parameter. This eliminates the analytics/browser-history/referrer exposure identified in Finding 8.2.

The route is `/unauthorized` (not `/auth/denied?username=...` as DESIGN.md originally proposed). The implementation chose the safer approach.

---

## Overall Verdict

**⚠️ Ship with known limitations**

### Why not "Must fix before shipping"

All three original Critical findings are resolved in server-side code. The route protection layer is complete: middleware exists with correct anchored patterns, all route handlers have defense-in-depth `auth()` guards, the `ALLOWED_GITHUB_USERS` startup check is fail-closed, session lifetime is set explicitly to 24 hours, `callbackUrl` is validated at both the middleware and page layers, and `approvedBy` is enforced server-side.

### Remaining limitations and their mitigations

1. **SSE `withCredentials` not yet implemented (the original Critical Finding 2).**
   The server-side SSE guard is in place and correct. The frontend `EventSource` client does not yet exist in the codebase — the SSE feature is not currently wired up. This means the SSE endpoint is server-side protected but the feature is non-functional. When the frontend SSE client is written, it must pass `{ withCredentials: true }`. This is a known, documented, and tracked limitation (PM_CHECKLIST OQ6). It does not represent an active security hole today because no client code calls the endpoint.

   **Required action before SSE goes live:** `new EventSource(url, { withCredentials: true })` is mandatory. This must be enforced in code review on the SSE integration PR, not post-ship.

2. **Rate limiting is a deployment gate, not yet confirmed.**
   No platform-level rate limiting configuration is present in the repository. This must be confirmed as active before internet-facing exposure.

3. **`AUTH_SECRET` startup: fails on first sign-in, not process start.**
   If `ALLOWED_GITHUB_USERS` is unset, the error is thrown on the first sign-in attempt rather than at process start. The app will start successfully but deny the first login with an unhandled error. This is the expected behavior given Next.js's module loading model. It is fail-closed and safe; it is not fail-obvious at deploy time.

### Items acceptable as known limitations (no action required before ship)

- Stateless sessions: no individual session revocation. `AUTH_SECRET` rotation is the only revocation mechanism. Documented as an accepted v1 tradeoff.
- Active SSE connections are not terminated when session expires — only new connections are blocked. Acceptable and documented.
- Revocation window of 2–10 minutes for whitelist changes (deploy propagation delay). Acceptable for an internal tool.
- No audit log of `triggeredBy` on `AgentRun`. Medium severity, recommended for v1.1.

### Pre-ship checklist

- [ ] Confirm platform-level rate limiting is active on the deployment (Vercel edge rules, Cloudflare, or WAF)
- [ ] Add `triggeredBy: session.user.githubUsername` to `AgentRun` creation in the move handler (cost attribution)
- [ ] Enforce `withCredentials: true` on the SSE `EventSource` call in the SSE integration PR before that PR ships — make it a PR checklist item, not an afterthought
