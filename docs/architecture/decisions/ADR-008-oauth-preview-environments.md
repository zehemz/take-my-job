# ADR-008 — OAuth on Vercel Preview Environments

**Status:** Accepted  
**Date:** 2026-04-14  
**Authors:** engineering

---

## Context

GitHub OAuth requires exact callback URL registration — wildcards are not supported. Vercel
preview deployments get dynamic URLs (`https://<project>-<hash>-<org>.vercel.app`) that
cannot be pre-registered, so OAuth is broken on preview envs out of the box.

Two compounding issues were identified:

1. **Auth.js host inference** — Without `trustHost: true`, Auth.js v5 does not trust Vercel's
   `x-forwarded-host` header and cannot construct the correct callback URL for the current
   deployment. The OAuth `redirect_uri` parameter is therefore wrong, and GitHub rejects it
   even when the URL *is* registered.

2. **GitHub callback URL registration** — GitHub OAuth Apps match `redirect_uri` exactly.
   Per-PR deployment URLs (`<project>-<hash>-<org>.vercel.app`) are not predictable in
   advance and cannot be registered automatically.

---

## Decision

### 1. Enable `trustHost` in Auth.js

Add `trustHost: true` to the `NextAuth(...)` config in `auth.ts`. This instructs Auth.js to
trust the `x-forwarded-host` and `host` headers when constructing the base URL, allowing the
callback URL to match the actual deployment host.

This is safe on Vercel because the platform strips or overwrites `x-forwarded-host` from
untrusted upstream callers before the request reaches the function.

### 2. Use separate GitHub OAuth Apps per environment

| Environment | OAuth App | Registered callback URL |
|-------------|-----------|------------------------|
| Production  | `kobani-prod` | `https://<prod-domain>/api/auth/callback/github` |
| Preview     | `kobani-preview` | `https://<project>-git-<branch>-<org>.vercel.app/api/auth/callback/github` (one entry per active review branch) |
| Local dev   | `DEV_AUTH_BYPASS=true` | n/a |

Vercel project settings scope `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` per environment
(Production vs. Preview), so each environment authenticates against its own OAuth App.

### 3. Set `AUTH_URL` for preview deployments

In Vercel project settings, add an `AUTH_URL` environment variable scoped to **Preview**,
pointing to the stable branch alias URL:

```
AUTH_URL = https://<project>-git-<branch>-<org>.vercel.app
```

Vercel issues two URL formats per deployment:

- **Deployment URL** (`VERCEL_URL`) — unique per build; changes on every push. Not useful here.
- **Branch alias URL** (`VERCEL_BRANCH_URL`) — stable for a given branch name; only changes if
  the branch is renamed. Use this as `AUTH_URL` and register it in the preview OAuth App.

When a new review branch needs OAuth, add its branch alias URL to the preview OAuth App callback
list and update `AUTH_URL` in Vercel for that branch's preview environment. This is a manual
but infrequent step (one entry per branch, not per commit).

---

## Alternatives Considered

### A. Single OAuth App with all preview URLs registered

Technically possible but operationally fragile: every new branch requires a GitHub OAuth App
setting change, and the list grows unbounded. Rejected in favour of a separate app that keeps
production credentials isolated.

### B. Auth proxy / fixed relay domain

Route all OAuth redirects through a fixed proxy domain that then forwards to the real preview
URL. Adds infra complexity and a single point of failure. Overkill for the current team size.

### C. Vercel Preview Deployment Protection with shared secret bypass

Vercel's Deployment Protection feature gates preview URLs behind a shared secret or SSO. This
protects the app surface but doesn't fix the OAuth flow itself. Not a substitute.

### D. GitHub App instead of OAuth App

GitHub Apps support more flexible permission scopes and webhook callbacks, but the redirect URL
constraint is the same. Migration cost is not justified by the benefit.

---

## Setup Checklist (one-time, per environment)

**Preview OAuth App (github.com/settings/applications/new):**
- [ ] App name: `kobani-preview` (or similar)
- [ ] Homepage URL: any (e.g. production URL)
- [ ] Authorization callback URL: `https://<project>-git-<branch>-<org>.vercel.app/api/auth/callback/github`
  - Add one entry per active review branch via "Edit" → "Add another callback URL"

**Vercel project settings → Environment Variables (Preview scope):**
- [ ] `GITHUB_CLIENT_ID` = preview OAuth App client ID
- [ ] `GITHUB_CLIENT_SECRET` = preview OAuth App client secret
- [ ] `AUTH_URL` = `https://<project>-git-<branch>-<org>.vercel.app`
- [ ] `AUTH_SECRET` = same value as production (or a separate secret)
- [ ] `ALLOWED_GITHUB_USERS` = same whitelist as production

**Per new review branch:**
- [ ] Add the branch alias URL to the preview OAuth App callback list
- [ ] Confirm `AUTH_URL` is set correctly in Vercel for that branch

---

## Consequences

- Preview deployments can use GitHub OAuth login without touching production credentials.
- A new review branch requires a one-time GitHub OAuth App callback URL registration — low
  friction given how infrequently branches are created.
- Production OAuth App credentials remain isolated; a compromised preview secret cannot be used
  to impersonate production.
- `trustHost: true` must remain set; removing it breaks preview auth silently.
