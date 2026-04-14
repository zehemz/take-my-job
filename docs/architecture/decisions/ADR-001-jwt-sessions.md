# ADR-001 — JWT sessions over DB-backed sessions

**Date:** 2026-04-13
**Status:** Accepted
**Deciders:** product-pm, frontend-dev, security-expert

---

## Context

When adding GitHub OAuth authentication via NextAuth.js v5, we needed to choose
between:

1. **JWT sessions** — session state encoded in a signed cookie, validated on
   each request by verifying the signature. No DB reads per request.
2. **DB-backed sessions** — session token stored in the database; every request
   does a DB lookup to validate.

---

## Decision

Use **JWT sessions** (NextAuth.js default with no database adapter).

---

## Reasoning

| Concern | JWT | DB-backed |
|---------|-----|-----------|
| Prisma schema changes | None | Adds Session, Account, User tables |
| Request overhead | Zero DB reads | 1 DB read per request |
| Revocation granularity | `AUTH_SECRET` rotation (all sessions) | Per-session deletion |
| Complexity | Low | Medium |
| Acceptable for this project | Yes | Overkill for v1 |

The whitelist is enforced at sign-in only (see ADR-002), so there is no
per-request need to re-read user state from a database. JWT is sufficient.

---

## Consequences

- **Positive:** Zero schema changes, zero DB overhead per request.
- **Negative:** Individual session revocation is not possible. Emergency
  revocation requires rotating `AUTH_SECRET`, which signs out all users
  simultaneously.
- **Mitigation:** Session `maxAge` is set to **24 hours** (not the Auth.js
  30-day default) to limit the blast radius of a compromised session.

---

## Revisit when

- Fine-grained per-user revocation is required (e.g. shared team accounts).
- The app scales to a point where session storage cost is negligible vs. the
  operational benefit of per-session control.
