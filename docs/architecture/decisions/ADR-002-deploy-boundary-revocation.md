# ADR-002 — Deploy boundary as whitelist revocation boundary

**Date:** 2026-04-13
**Status:** Accepted
**Deciders:** product-pm, frontend-dev, security-expert

---

## Context

The PM's original requirement was that removing a username from the whitelist
should take effect immediately — on the user's next request. The tech spec used
JWT sessions (ADR-001), where the whitelist is only checked at sign-in.

There was a tension: JWT sessions + per-request whitelist check would require
reading `process.env.ALLOWED_GITHUB_USERS` on every API call, adding complexity
and potential for stale-value bugs during hot-reloads.

---

## Decision

**The deploy boundary is the revocation boundary.**

Whitelist changes require updating the `ALLOWED_GITHUB_USERS` environment
variable and redeploying. The server restart that accompanies a redeploy is the
revocation event — no per-request lookup is needed.

For **emergency revocation** before the next scheduled deploy, rotate
`AUTH_SECRET`. This immediately invalidates all active JWT sessions; only
whitelisted users can sign back in.

---

## Reasoning

`ALLOWED_GITHUB_USERS` is an environment variable. In any reasonable deployment
pipeline (Vercel, Railway, Fly.io, Docker):

1. You update the env var in the platform dashboard.
2. You trigger a redeploy (or it triggers automatically).
3. The new process starts with the updated whitelist.
4. Sessions from the old process are still valid JWT cookies — but signing in
   again will be rejected if the username is no longer on the list.

The window between env var change and redeploy is a CI/CD pipeline run
(typically 2–10 minutes). This is an acceptable risk for an internal tool.

---

## Consequences

- **Positive:** No per-request env-var parsing, no stale-value bugs, simpler
  `signIn` callback.
- **Negative:** A removed user retains access for up to 24 hours (session
  max-age) after the redeploy that removes them — unless `AUTH_SECRET` is
  rotated.
- **Emergency procedure:**
  1. `openssl rand -hex 32` → copy output
  2. Set `AUTH_SECRET` to the new value in deployment platform
  3. Remove the username from `ALLOWED_GITHUB_USERS`
  4. Redeploy — **rotation takes effect only after redeploy**
  5. All users are signed out; only whitelisted users can sign back in.

---

## Revisit when

- The team needs sub-minute revocation (e.g. a contractor account that must be
  cut off immediately). At that point, switch to DB-backed sessions (ADR-001
  revisit) with a per-request session validity check.
