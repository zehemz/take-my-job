# Auth Technical Spec — GitHub OAuth + User Whitelist

**Project:** Kobani  
**Date:** 2026-04-13  
**Status:** Draft

---

## 1. Library Choice

**NextAuth.js v5 (Auth.js)** with the GitHub provider.

### Why NextAuth.js v5

| Concern | NextAuth.js v5 | Alternative: iron-session + custom OAuth | Alternative: Clerk/Auth0 |
|---|---|---|---|
| Next.js App Router support | First-class — built for it | Manual wiring | Via SDK, but opinionated |
| GitHub OAuth | Built-in provider, 5 LOC config | Implement from scratch | Built-in |
| JWT sessions (no DB adapter) | Default mode | Manual | Managed |
| Middleware integration | `auth()` helper wraps middleware | Manual cookie check | Middleware SDK |
| Bundle size | ~30 KB | ~5 KB (but more code to own) | Larger, SaaS dependency |
| Maintenance surface | Actively maintained, widely used | Owned by us | Vendor lock-in |

NextAuth v5 is chosen because it handles the entire OAuth dance (redirect, callback, token exchange, session creation) with a single config file, integrates with Next.js middleware via its exported `auth()` helper, and requires no database adapter or schema changes for a JWT-based session — exactly the right tradeoff for a v1 whitelist implementation.

---

## 2. New Dependencies

```bash
npm install next-auth@beta
```

The `beta` dist-tag resolves to v5.x (Auth.js). No other packages are required for JWT sessions with the GitHub provider. Do **not** install `@auth/prisma-adapter` for v1 — the JWT strategy keeps sessions stateless.

**Resulting addition to `package.json` `dependencies`:**

```json
"next-auth": "^5.0.0-beta.x"
```

---

## 3. Environment Variables

Add to `.env.local` (and to the deployment environment / Vercel dashboard):

```bash
# GitHub OAuth App credentials
# Create at: https://github.com/settings/developers → OAuth Apps
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Auth.js signing/encryption secret — generate with: openssl rand -hex 32
# (hex produces 32 bytes of entropy; base64-32 only produces 24 bytes and must not be used)
AUTH_SECRET=your_64_hex_char_secret

# Comma-separated list of GitHub usernames allowed to log in
# e.g. ALLOWED_GITHUB_USERS=lucasbais,johndoe,janedoe
ALLOWED_GITHUB_USERS=username1,username2
```

### GitHub OAuth App setup

When creating the GitHub OAuth App:

- **Homepage URL:** `http://localhost:3000` (dev) / your production URL
- **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
  - Production: `https://your-domain.com/api/auth/callback/github`

---

## 4. File Structure

### New files

```
auth.ts                                  ← Auth.js config (provider + whitelist callback)
middleware.ts                            ← Next.js middleware for route protection
app/
  api/
    auth/
      [...nextauth]/
        route.ts                         ← Auth.js request handler (GET + POST)
  login/
    page.tsx                             ← Sign-in page with GitHub button
  unauthorized/
    page.tsx                             ← Access denied page for non-whitelisted users
  _components/
    session-provider.tsx                 ← Client-side SessionProvider wrapper
```

### Modified files

```
app/layout.tsx                           ← Wrap body children with SessionProvider
```

No changes to `prisma/schema.prisma` — see section 9.

---

## 5. `auth.ts` — Auth.js Config

This is the central config file. It lives at the project root (next to `package.json`).

### Startup validation

The first thing `auth.ts` does at module load time is assert that `ALLOWED_GITHUB_USERS` is present and non-empty. This causes the process to crash immediately on startup if the variable is missing or accidentally cleared, producing a loud, unambiguous error rather than a silent "everyone is blocked" outage.

```typescript
// auth.ts
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

// ── Startup assertion ────────────────────────────────────────────────────────
// Fail loudly if ALLOWED_GITHUB_USERS is missing or empty. An empty list would
// silently block every login with no indication of misconfiguration.
if (!process.env.ALLOWED_GITHUB_USERS?.trim()) {
  throw new Error(
    'ALLOWED_GITHUB_USERS is not set. Set it to a comma-separated list of ' +
    'GitHub usernames (e.g. ALLOWED_GITHUB_USERS=alice,bob).'
  );
}

// ── GitHub username format guard ─────────────────────────────────────────────
// GitHub enforces ASCII-only usernames, but we validate the format defensively
// before any whitelist comparison.
const GITHUB_LOGIN_RE = /^[a-z0-9-]{1,39}$/i;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],

  session: {
    // Explicitly set to 24 hours. Do not rely on the Auth.js default (30 days),
    // which would create an unacceptably long revocation window given that this
    // design does not re-check the whitelist on every request.
    maxAge: 24 * 60 * 60,
  },

  callbacks: {
    /**
     * Whitelist enforcement. Called after GitHub returns the user profile
     * but before the session is created.
     *
     * The whitelist is read fresh from process.env on every sign-in rather than
     * cached at module load time. This avoids a stale-value bug if the variable
     * is updated between process restarts in development.
     *
     * Returning false redirects the user to /api/auth/error?error=AccessDenied,
     * which the pages.error config routes to /unauthorized.
     */
    signIn({ profile }) {
      const login = profile?.login as string | undefined;

      // Reject if login is missing or does not match expected GitHub format
      if (!login || !GITHUB_LOGIN_RE.test(login)) return false;

      // Read whitelist fresh on each sign-in
      const allowedUsers = (process.env.ALLOWED_GITHUB_USERS ?? '')
        .split(',')
        .map((u) => u.trim().toLowerCase())
        .filter(Boolean);

      return allowedUsers.includes(login.toLowerCase());
    },

    /**
     * Extend the JWT with fields we want available in the session.
     * `profile` is only present on the initial sign-in trigger.
     */
    jwt({ token, profile }) {
      if (profile) {
        token.githubUsername = (profile.login as string) ?? null;
        token.avatarUrl = (profile.avatar_url as string) ?? null;
      }
      return token;
    },

    /**
     * Expose the extended JWT fields to session consumers (server + client).
     */
    session({ session, token }) {
      session.user.githubUsername = token.githubUsername as string;
      session.user.avatarUrl = token.avatarUrl as string;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/unauthorized',   // catches AccessDenied and other OAuth errors
  },
});
```

### Type augmentation

Add a `types/next-auth.d.ts` (or inline in `auth.ts` above the config) to keep TypeScript happy with the extended session fields:

```typescript
// types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubUsername: string;
      avatarUrl: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    githubUsername?: string | null;
    avatarUrl?: string | null;
  }
}
```

---

## 6. `middleware.ts` — Route Protection

> **Naming convention:** All public auth pages in this implementation use `/login` and `/unauthorized`. Any other document that references `/auth/signin` or `/auth/denied` (notably DESIGN.md) is outdated and must be updated to match these paths. Do not introduce `/auth/signin` — it conflicts with Auth.js's own internal `/api/auth/signin` route and causes confusing double-handling.

```typescript
// middleware.ts  (project root, next to auth.ts)
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  // User is authenticated — let them through
  if (session) return NextResponse.next();

  // Unauthenticated — redirect to /login, preserving the intended destination
  const loginUrl = new URL('/login', nextUrl.origin);
  loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
});

/**
 * Route protection matrix.
 *
 * The matcher uses Next.js path patterns. Auth.js callback routes and
 * static assets must be excluded so the OAuth flow itself is never blocked.
 *
 * IMPORTANT — matcher patterns are anchored (^ implied by Next.js when the
 * pattern begins at the start of the path after the leading /). We use a
 * positive-list approach for protected API routes plus a negative-list
 * exclusion for the app shell, so that adding new routes is safe by default.
 *
 * Public (middleware excluded):
 *   /login                ← Sign-in page
 *   /unauthorized         ← Access denied page
 *   /api/auth/**          ← Auth.js OAuth callbacks (must never be blocked)
 *   /_next/**             ← Next.js internals
 *   /favicon.ico, /icon.png, /apple-icon.png
 *
 * Protected (middleware runs, unauthenticated request → redirect to /login):
 *   /                     ← Home / board list
 *   /boards/**            ← Individual board views
 *   /attention/**         ← Attention queue
 *   /api/boards/**        ← REST API
 *   /api/cards/**         ← REST API
 *   /api/events/**        ← SSE stream
 */
export const config = {
  matcher: [
    /*
     * Anchored negative-list: match everything EXCEPT the public paths.
     *
     * Each exclusion is anchored to the start of the path segment after the
     * leading slash so that substring collisions are impossible:
     *   - "login"           only matches /login, not /api/login-status
     *   - "unauthorized"    only matches /unauthorized, not /api/unauthorized-action
     *   - "api/auth"        only matches /api/auth/*, not /api/auth-debug
     *   - "_next/static"    only matches /_next/static/*
     *   - "_next/image"     only matches /_next/image/*
     *   - "favicon\\.ico"   only matches /favicon.ico (dot escaped)
     *   - "icon\\.png"      only matches /icon.png
     *   - "apple-icon\\.png" only matches /apple-icon.png
     */
    '/((?!login$|unauthorized$|api/auth(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$|icon\\.png$|apple-icon\\.png$).*)',
  ],
};
```

### Route protection matrix (summary)

| Path pattern | Protected | Notes |
|---|---|---|
| `/` | Yes | Board list |
| `/boards/[id]` | Yes | Board detail |
| `/attention` | Yes | Attention queue |
| `/api/boards/**` | Yes | REST API |
| `/api/cards/**` | Yes | REST API |
| `/api/events/**` | Yes | SSE stream |
| `/login` | No | Sign-in page |
| `/unauthorized` | No | Access denied page |
| `/api/auth/**` | No | Auth.js OAuth handler |
| `/_next/**` | No | Build assets |

---

## 7. `app/api/auth/[...nextauth]/route.ts` — Auth.js Handler

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

This is the entire file. Auth.js's `handlers` export already provides the correct GET and POST functions for `/api/auth/signin`, `/api/auth/callback/github`, `/api/auth/signout`, and `/api/auth/session`.

---

## 8. `app/login/page.tsx` — Sign-in Page

```typescript
// app/login/page.tsx
import { signIn } from '@/auth';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-white text-2xl font-semibold">Kobani</h1>
        <p className="text-zinc-400 text-sm text-center">
          Sign in with your GitHub account to continue.
        </p>
        <form
          action={async () => {
            'use server';

            // Validate callbackUrl server-side to prevent open-redirect attacks.
            // Accept only paths that start with a single "/" (relative URLs).
            // Reject anything starting with "//" (protocol-relative) or containing
            // a scheme ("javascript:", "https:"), which would redirect off-origin.
            const raw = searchParams.callbackUrl;
            const safeCb =
              raw && raw.startsWith('/') && !raw.startsWith('//')
                ? raw
                : '/';

            await signIn('github', { redirectTo: safeCb });
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-2 bg-white text-zinc-900 px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-zinc-100 transition-colors"
          >
            Continue with GitHub
          </button>
        </form>
      </div>
    </main>
  );
}
```

---

## 9. `app/unauthorized/page.tsx` — Access Denied Page

```typescript
// app/unauthorized/page.tsx
export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 flex flex-col items-center gap-4 w-full max-w-sm text-center">
        <h1 className="text-white text-2xl font-semibold">Access Denied</h1>
        <p className="text-zinc-400 text-sm">
          Your GitHub account is not on the Kobani whitelist. Contact an admin
          to request access.
        </p>
        <a
          href="/login"
          className="text-zinc-500 text-sm underline hover:text-zinc-300 transition-colors"
        >
          Try a different account
        </a>
      </div>
    </main>
  );
}
```

---

## 10. `app/_components/session-provider.tsx` — Client SessionProvider

Next.js App Router requires a client boundary around the Auth.js `SessionProvider` (which uses context internally).

```typescript
// app/_components/session-provider.tsx
'use client';

import { SessionProvider } from 'next-auth/react';

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

---

## 11. Session Shape

What is available in the session object (server-side via `auth()` or client-side via `useSession()`):

```typescript
{
  user: {
    name: string | null;         // GitHub display name (e.g. "Lucas Bais")
    email: string | null;        // GitHub primary email (may be null if private)
    image: string | null;        // GitHub avatar URL (same as avatarUrl below)
    githubUsername: string;      // GitHub login handle (e.g. "lbais") — from JWT callback
    avatarUrl: string;           // GitHub avatar URL — from JWT callback (redundant with image, kept explicit)
  };
  expires: string;               // ISO 8601 — when the session JWT expires
}
```

`githubUsername` is the field used for the whitelist check and for populating `Card.approvedBy` when a user approves a card (it maps cleanly to the existing `approvedBy: string` field on the `Card` model).

### Whitelist enforcement boundary and revocation

**Whitelist is enforced at sign-in only.** Because `ALLOWED_GITHUB_USERS` is an environment variable, changes require a server redeploy. The redeploy boundary is the revocation boundary — no per-request whitelist lookup is needed. A user removed from `ALLOWED_GITHUB_USERS` will lose access on their next sign-in attempt after the redeploy; their existing JWT session remains valid until it expires (24 hours — see `session.maxAge` in `auth.ts`) or until it is explicitly invalidated.

**Emergency revocation — rotating `AUTH_SECRET`:** If a user must be removed immediately, before the next scheduled deploy, rotate `AUTH_SECRET` to a new random value and redeploy. Because `AUTH_SECRET` is the key used to sign and encrypt all JWT session cookies, rotating it instantly invalidates every active session across all users. All users are forced back to `/login` on their next request. This is a blunt instrument (all users are signed out, not just the target), so it should be reserved for urgent cases. The steps are:

1. Generate a new secret: `openssl rand -hex 32`
2. Update `AUTH_SECRET` in the deployment environment (e.g. Vercel dashboard).
3. Remove the target username from `ALLOWED_GITHUB_USERS` in the same deploy.
4. **Trigger a redeploy.** Updating environment variables in the deployment dashboard does NOT invalidate active sessions until the process restarts. You must trigger an explicit redeploy after updating `AUTH_SECRET`. All existing sessions are immediately invalid after the new process is serving traffic; the removed user cannot sign back in.

---

## 12. API Route Protection

### Defense-in-depth auth guard (mandatory for every handler)

The Next.js middleware (section 6) blocks unauthenticated requests at the edge and redirects browsers to `/login`. However, middleware alone is insufficient: a matcher misconfiguration, a missing middleware file, or a direct programmatic request that does not follow redirects would bypass it entirely, exposing routes that trigger Anthropic API calls.

**Every route handler must call `auth()` as a secondary check.** This is not optional defense-in-depth — it is a required implementation step. A handler without this guard must be treated as a bug.

```typescript
// Required pattern — top of every handler in every API route file
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... handler logic
}
```

Apply this guard to every handler in:

- `app/api/boards/route.ts` (GET)
- `app/api/boards/[id]/route.ts` (all methods)
- `app/api/boards/[id]/cards/route.ts` (all methods)
- `app/api/cards/[id]/route.ts` (GET, PATCH, DELETE)
- `app/api/cards/[id]/move/route.ts` (POST) — **highest priority**: this triggers agent runs and incurs Anthropic API cost
- `app/api/events/[cardId]/route.ts` (GET) — see SSE note below
- Any future API routes

This produces a clean 401 JSON response rather than a redirect, which is the correct behavior for API consumers.

### SSE endpoint — `EventSource` and cookie delivery

`GET /api/events/[cardId]` is consumed via the browser's `EventSource` API. **`EventSource` does not send cookies by default** — `withCredentials` is `false` unless explicitly set. In that default mode, the session cookie is omitted entirely, so the middleware session check always sees an unauthenticated request. The middleware will redirect to `/login`, and `EventSource` does not follow redirects meaningfully — it reconnects and retries, creating an infinite redirect loop. Alternatively, if the SSE route is excluded from the middleware matcher to avoid the loop, the endpoint is left completely unprotected.

The correct fix is to always instantiate `EventSource` with `withCredentials: true`:

```typescript
// In any client component or hook that opens the SSE connection
const es = new EventSource(`/api/events/${cardId}`, { withCredentials: true });
```

This causes the browser to send the session cookie with the SSE request. It works correctly for same-origin requests, which is what Kobani uses.

Additionally, the `app/api/events/[cardId]/route.ts` handler **must** include the standard `auth()` guard at the top, as it does for all other routes. Even with `withCredentials: true` set on the client, the server-side `auth()` call is the authoritative check.

Known limitation: if a session expires while an SSE stream is already open, the server cannot retroactively close the connection — it has already sent HTTP 200 and begun streaming. The expiry only takes effect when the client makes a new connection. Given the 24-hour `maxAge`, this is an acceptable tradeoff for v1.

### `approvedBy` must be set server-side from the session

The `PATCH /api/cards/[id]` handler must never use the `approvedBy` value from the request body. Any client can send `{ "approvedBy": "anyusername" }` and forge attribution. After the `auth()` guard passes, if the update includes an approval action, set `approvedBy` from the authenticated session:

```typescript
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: UpdateCardRequest = await req.json();

  const card = await prisma.card.update({
    where: { id: params.id },
    data: {
      // ... other fields from body ...

      // approvedBy is always set from the authenticated session, never from body.
      // Ignore body.approvedBy entirely — it is a client-supplied identity claim.
      ...(body.approvedBy !== undefined && {
        approvedBy: session.user.githubUsername,   // ← always from session
        approvedAt: new Date(),
      }),
    },
    include: { agentRuns: { orderBy: { createdAt: 'asc' } } },
  });

  // ...
}
```

This ensures `Card.approvedBy` is always a verified GitHub username, making it a trustworthy audit trail entry.

---

## 13. Prisma Schema Changes

**None required for v1.**

Auth.js v5 defaults to **JWT sessions** (stateless, stored in a signed/encrypted cookie). No database tables are needed for sessions, users, or accounts.

If a future version requires persistent sessions, audit logs, or per-user board ownership, the `@auth/prisma-adapter` can be added with the standard NextAuth schema (Account, Session, User, VerificationToken models). That migration path is straightforward and non-breaking to the existing schema. For now, the existing `schema.prisma` is unchanged.

---

## 14. Migration Notes — Existing Code Changes

### `app/layout.tsx`

The root layout must wrap `{children}` with the client-side `AuthSessionProvider`. The layout itself remains a Server Component; only the provider wrapper is a Client Component (see section 10).

**Before:**

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
```

**After:**

```typescript
import { AuthSessionProvider } from './_components/session-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 min-h-screen flex flex-col">
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
```

### Existing API routes (`app/api/boards/route.ts`, `app/api/cards/[id]/route.ts`)

Add the `auth()` guard at the top of each handler as shown in section 12. This is a 3-line addition per handler; no logic changes.

### `Card.approvedBy` population

The `UpdateCardRequest.approvedBy` field is currently a free-form client-supplied string. After auth is added, the server must **ignore** the `approvedBy` value from the request body and instead set it from `session.user.githubUsername` whenever an approval action is triggered. See section 12 for the exact implementation. The UI does not need to send `approvedBy` at all — if it does, the server discards it. No API type or schema change is needed; the field type stays `string`.

### `.env.local`

Add the four new variables from section 3. Existing `DATABASE_URL` is unchanged.

### `tsconfig.json`

If `types/next-auth.d.ts` is placed outside `app/` or `lib/`, confirm `compilerOptions.typeRoots` or `include` covers the `types/` directory. The default Next.js tsconfig includes `**/*.d.ts` so this is typically not needed.

---

## 15. Implementation Order

1. Create GitHub OAuth App, capture `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
2. Add env vars to `.env.local`.
3. `npm install next-auth@beta`.
4. Create `auth.ts` with provider + whitelist callbacks.
5. Create `types/next-auth.d.ts` for session type augmentation.
6. Create `app/api/auth/[...nextauth]/route.ts`.
7. Create `middleware.ts`.
8. Create `app/login/page.tsx` and `app/unauthorized/page.tsx`.
9. Create `app/_components/session-provider.tsx`.
10. Update `app/layout.tsx` to wrap with `AuthSessionProvider`.
11. Add `auth()` guards to existing API route handlers.
12. Test: unauthenticated → redirected to `/login`; non-whitelisted GitHub user → `/unauthorized`; whitelisted user → full access.
