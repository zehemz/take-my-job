# Auth UX Design — Kobani

GitHub OAuth with username whitelist gating.

---

## 1. Design Principles

**Minimal friction, maximum clarity.**
Auth is a gate, not a feature. Every auth screen should feel like a natural extension of the app's existing shell, not a jarring detour. These principles guide every decision below.

**Inherit the existing palette without exception.**
The app lives on `zinc-950` with `zinc-900` surfaces, `zinc-800`/`zinc-700` borders and cards, `zinc-100`/`zinc-200` primary text, `zinc-400`/`zinc-500`/`zinc-600` for secondary and muted text, and `indigo-600` as the single accent color. Auth screens use the same tokens — no blues, greens, or brand-new hues.

**One action per screen.**
The sign-in page has one button. The access-denied page has one. No option paralysis. Users in the happy path move through auth without thinking.

**Errors are honest, not apologetic.**
Access denied is not a "Sorry!" screen. It is a clear statement of fact with a brief, neutral explanation — no shame, no excessive softening.

**Loading states are never blank.**
Any redirect or async step shows a spinner inside the familiar nav shell. The user never sees a white flash or a broken layout.

**Auth state lives in the nav, not on a separate settings page.**
The user avatar in `TopNav` is the entire auth affordance once signed in. Clicking it reveals the sign-out option. No separate account page is needed.

---

## 2. User Flows

### 2a. Unauthenticated user visits any page

```
User visits any URL (/, /boards/[id], /attention, etc.)
        |
        v
  Middleware checks session cookie
        |
   No valid session?
        |
        v
  301 redirect → /auth/signin
  (original URL stored in ?callbackUrl= query param)
        |
        v
  Sign-in page rendered
```

All routes except `/auth/signin`, `/auth/callback`, and `/auth/error` are protected. The middleware intercepts at the edge before any page component renders.

---

### 2b. GitHub OAuth flow

```
User on /auth/signin clicks "Continue with GitHub"
        |
        v
  Browser redirects to GitHub OAuth authorize URL
  (scope: read:user — username only, no repo access)
        |
        v
  User reviews GitHub permissions → clicks "Authorize"
        |
        v
  GitHub redirects to /auth/callback?code=...&state=...
        |
        v
  Server exchanges code for access token
  Server fetches GitHub user profile → extracts login (username)
        |
        v
       Is username in the whitelist?
       /                          \
     YES                          NO
      |                            |
      v                            v
  Create/update session      Redirect to /auth/denied
  Set session cookie         (no session cookie set)
      |
      v
  Redirect to callbackUrl or / (board list)
```

GitHub OAuth uses the minimal `read:user` scope. The app never stores GitHub tokens — only the username and a derived display name/avatar URL are persisted in the session.

---

### 2c. Whitelisted user — happy path

```
Sign-in page
    |
    | (clicks "Continue with GitHub")
    v
GitHub OAuth (external)
    |
    v
/auth/callback — whitelist check passes
    |
    v
Session created → redirect to / (or original callbackUrl)
    |
    v
Board list page — TopNav now shows:
  [ Kobani logo ] [ / Board Name ]   [ bell ] [ avatar + username ] [ ··· ]
```

The board list is the default landing page. If a `callbackUrl` was stored, the user lands there instead (e.g., they tried to reach `/boards/abc` while signed out and end up there after signing in).

---

### 2d. Non-whitelisted user — access denied

```
/auth/callback — whitelist check fails
    |
    v
Redirect to /auth/denied
    |
    v
Access Denied page
  - No session cookie set
  - No nav with app content (bare auth shell)
  - Clear explanation + GitHub username shown
  - Single action: "Sign in with a different account"
    (clears any partial state, returns to /auth/signin)
```

The username is passed as a query param to `/auth/denied?username=<login>` so the page can show which account was rejected. This avoids the user wondering if they mistyped.

---

### 2e. Sign-out flow

```
Signed-in user clicks avatar in TopNav
    |
    v
Dropdown opens (inline, no page navigation):
  [ @username ]
  [ Sign out  ]
    |
    | (clicks "Sign out")
    v
POST /api/auth/signout (invalidates session server-side)
    |
    v
Client clears session cookie
    |
    v
Redirect to /auth/signin
```

Sign-out is a server action or API route, not a client-side-only cookie delete, so the session is properly invalidated.

---

## 3. Screen Designs

### 3a. Sign-in Page (`/auth/signin`)

**Layout:** Full viewport, `bg-zinc-950`. Centered card, vertically and horizontally, using `flex items-center justify-center min-h-screen`.

**Card:** `bg-zinc-900 border border-zinc-800 rounded-2xl p-10 w-full max-w-sm` — matches the existing board cards in `BoardListClient`.

**Structure (top to bottom):**

```
┌─────────────────────────────────────┐
│                                     │
│     [logo 32×34]  Kobani            │  ← logo + wordmark, centered
│                                     │
│   Sign in to continue               │  ← h1, zinc-100, text-xl font-semibold
│   This workspace is invite-only.    │  ← p, zinc-500, text-sm, mt-1
│                                     │
│  ┌───────────────────────────────┐  │
│  │  [GitHub mark]  Continue with │  │  ← primary button (see below)
│  │                 GitHub        │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

**Logo + wordmark:** `<Image src="/logo.png" width={32} height={34} />` beside `Kobani` in `text-xl font-semibold text-zinc-100`. Same treatment as `TopNav` but larger. Centered using `flex items-center justify-center gap-2 mb-8`.

**Heading block:** `mb-6 text-center`. Title `text-xl font-semibold text-zinc-100`. Subtitle `text-sm text-zinc-500 mt-1`.

**GitHub button:** Full-width. `bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-100 text-sm font-medium rounded-lg px-4 py-3 flex items-center justify-center gap-2.5 transition-colors duration-150 cursor-pointer w-full`. The GitHub mark SVG (`20×20`, filled `currentColor`) sits to the left of the label. No indigo here — the button is a surface action, not a destructive or primary CTA. This keeps the page calm and avoids an accent-colored wall of blue.

**Loading state of the button:** After click, the button label changes to `Redirecting to GitHub...` and the GitHub mark is replaced by the same spinner SVG already used in `AgentStatusBadge`. Button becomes `opacity-60 cursor-not-allowed pointer-events-none`.

**Error state** (e.g., GitHub OAuth failure returning the user to this page with `?error=`): A small alert bar renders above the button. `bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300` with the appropriate error message (see Section 5: Copy). The bar slides in with a simple CSS `animate-in fade-in` (Tailwind v3).

**No footer, no "forgot password", no register link.** The invite-only line is the sole explanation.

---

### 3b. Access Denied Page (`/auth/denied`)

**Layout:** Full viewport, `bg-zinc-950`. Same centered container as sign-in.

**Card:** Same `bg-zinc-900 border border-zinc-800 rounded-2xl p-10 w-full max-w-sm`.

```
┌─────────────────────────────────────┐
│                                     │
│     [logo 32×34]  Kobani            │
│                                     │
│   Access denied                     │  ← h1, zinc-100, text-xl font-semibold
│                                     │
│   @username is not on the           │  ← p, zinc-500, text-sm
│   Kobani access list. Contact       │
│   your workspace admin to           │
│   request access.                   │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Try a different account      │  │  ← secondary action button
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

**Heading:** `text-xl font-semibold text-zinc-100`. No "Sorry" or apology language.

**Body copy:** `text-sm text-zinc-500 mt-2 leading-relaxed`. The `@username` fragment is rendered in `text-zinc-300 font-mono` so it stands out clearly.

**Button:** Same surface-action style as the GitHub button on the sign-in page but without the GitHub mark. Label: "Try a different account". Clicking navigates to `/auth/signin` (Next.js `<Link>` rendered as a button for accessibility).

**No nav shell.** The user is not authenticated; showing `TopNav` with notification bells would be confusing and broken. The logo/wordmark in the card header provides enough branding.

---

### 3c. TopNav — Authenticated User Addition

The existing `UserMenu` component is a static `w-7 h-7 rounded-full bg-indigo-600` initials badge. In the authenticated design it becomes interactive and data-driven.

**Slot in TopNav (right side, existing order preserved):**

```
[ NotificationBell ]  [ UserMenu (avatar + dropdown) ]  [ ··· ]
```

**Avatar trigger:** `w-7 h-7 rounded-full overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-zinc-600 transition-all duration-150`. If the GitHub avatar URL is available, render `<Image src={avatarUrl} width={28} height={28} alt={username} />`. Fallback: the existing initials badge `bg-indigo-600`.

**Dropdown panel:** Renders below the avatar, right-aligned. `absolute top-10 right-0 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl shadow-black/40 py-1 z-50`. Closed by clicking outside (focus trap not required; it is not a modal).

```
┌──────────────────────┐
│  @username           │  ← text-xs text-zinc-400, px-3 py-2, not clickable
│  ─────────────────── │  ← border-t border-zinc-800
│  Sign out            │  ← text-sm text-zinc-300 hover:text-zinc-100
│                      │    hover:bg-zinc-800 px-3 py-2 cursor-pointer
└──────────────────────┘
```

The username row is a display element, not a link. It confirms to the user which account they are using. The separator is `<hr className="border-zinc-800 my-0.5" />`. Sign out triggers the server-side sign-out action and redirects to `/auth/signin`.

**No additional account management items.** The app does not have user settings; the menu stays minimal.

---

### 3d. OAuth Loading / Redirecting State

This state appears at two moments:
1. After the user clicks "Continue with GitHub" — before the browser redirect completes.
2. After GitHub redirects back to `/auth/callback` — while the server validates the code and checks the whitelist.

For moment (1), the button itself shows the inline spinner (see 3a). The full page does not change.

For moment (2), the `/auth/callback` route is a server-side route handler. The browser shows the Kobani favicon and `Kobani` title while the server round-trips. No client component is needed. If the round-trip takes more than ~400 ms (network latency with GitHub), the browser's native loading indicator is sufficient — no custom loading UI is designed for the callback route.

If a custom loading UI is desired in future, the pattern would be a full-page centered spinner inside the same `bg-zinc-950` shell, using the existing spinner SVG from `AgentStatusBadge`, at `w-8 h-8` scale, `text-zinc-500`. Label below: `"Signing in..."` in `text-sm text-zinc-500`.

---

## 4. Component Inventory

All new components live in `app/_components/` or `app/auth/` unless noted.

| Component | Path | Description |
|---|---|---|
| `AuthCard` | `app/_components/AuthCard.tsx` | Shared wrapper: full-viewport centering + card shell (`zinc-900`, `rounded-2xl`, `p-10`, `max-w-sm`). Used by sign-in and access-denied pages. Renders the logo/wordmark header. |
| `SignInPage` | `app/auth/signin/page.tsx` | Next.js page. Uses `AuthCard`. Renders GitHub button, handles `?error=` query param to show error bar. |
| `GitHubSignInButton` | `app/_components/GitHubSignInButton.tsx` | Client component. Full-width button with GitHub SVG mark. Manages its own loading state (replaces icon with spinner, disables interaction after click). Initiates OAuth redirect via Next Auth / custom handler. |
| `AuthErrorBar` | `app/_components/AuthErrorBar.tsx` | Displays a single error string in a `red-950`/`red-800` pill above the sign-in button. Accepts an `error` prop (string or null); renders nothing when null. |
| `AccessDeniedPage` | `app/auth/denied/page.tsx` | Next.js page. Uses `AuthCard`. Reads `?username=` from search params. Renders denial message + "Try a different account" link-button. |
| `UserMenu` | `app/_components/UserMenu.tsx` | Replaces the existing stub. Client component. Accepts `user: { login: string; avatarUrl: string; name?: string }`. Renders avatar trigger + dropdown with username and sign-out. |
| `SignOutButton` | (inline in `UserMenu`) | A `<button>` that calls the sign-out server action / API route. Kept inline in `UserMenu` rather than extracted, as it has no reuse elsewhere. |
| `AuthProvider` | `app/_components/AuthProvider.tsx` | Optional: thin client context provider wrapping the app shell, exposing session data to client components (avatar URL, username) without prop-drilling through `TopNav`. Only needed if the session library (e.g., `next-auth`) does not already provide a hook. |

**Modified components:**

| Component | Change |
|---|---|
| `app/layout.tsx` | Wrap `{children}` in `<AuthProvider>` (if used). No visual change. |
| `app/_components/TopNav.tsx` | Pass `user` prop (or read from context) into `UserMenu`. No structural change. |
| `app/_components/UserMenu.tsx` | Full rewrite of the existing stub (currently 9 lines). |

**New routes / route handlers:**

| Route | Type | Purpose |
|---|---|---|
| `app/auth/signin/page.tsx` | Next.js page | Sign-in screen |
| `app/auth/denied/page.tsx` | Next.js page | Access denied screen |
| `app/auth/callback/route.ts` | Next.js route handler | GitHub OAuth callback: exchange code, check whitelist, set session, redirect |
| `app/api/auth/signout/route.ts` | Next.js route handler | POST endpoint: invalidate session, clear cookie, redirect |
| `middleware.ts` | Next.js middleware | Edge middleware: session check on all routes, redirect unauthenticated users |

---

## 5. Copy

### Sign-in Page

| Element | Text |
|---|---|
| Page `<title>` | `Sign in — Kobani` |
| Heading | `Sign in to continue` |
| Subheading | `This workspace is invite-only.` |
| Button (default) | `Continue with GitHub` |
| Button (loading) | `Redirecting to GitHub...` |

### Sign-in Error Bar

Error codes come from the OAuth failure callback or are set by the server. The bar displays one line of human text.

| Error code | Displayed message |
|---|---|
| `OAuthCallback` | `GitHub sign-in failed. Please try again.` |
| `OAuthSignin` | `Could not reach GitHub. Check your connection and try again.` |
| `SessionRequired` | `Your session expired. Please sign in again.` |
| `default` (any other) | `Something went wrong. Please try again.` |

### Access Denied Page

| Element | Text |
|---|---|
| Page `<title>` | `Access denied — Kobani` |
| Heading | `Access denied` |
| Body (with username) | `@{login} is not on the Kobani access list. Contact your workspace admin to request access.` |
| Body (without username, fallback) | `Your GitHub account is not on the Kobani access list. Contact your workspace admin to request access.` |
| Button | `Try a different account` |

### UserMenu Dropdown

| Element | Text |
|---|---|
| Username row | `@{login}` |
| Sign-out item | `Sign out` |

### Loading / Callback State

| Element | Text |
|---|---|
| Page `<title>` during callback | `Signing in — Kobani` |
| Spinner label (if rendered) | `Signing in...` |

### Middleware / Session-expiry Toast (future)

If a session expires while the user is on a board page and they take an action that requires auth, a lightweight toast (not yet in scope for this feature) would read:

> `Session expired — please sign in again.`

---

## 6. Edge Cases

### 6a. Session expires while the user is actively using a board

**Scenario:** A user has a valid session cookie, but the server-side session record expires (e.g., the server restarts with a new secret, or a configured TTL is reached). The user is on `/boards/abc` and performs an action.

**Behavior:** The next API call or navigation event returns a `401`. The middleware on page navigation will catch the missing session and redirect to `/auth/signin?callbackUrl=/boards/abc`. If the expiry is discovered mid-SPA (during a client-side fetch, e.g., a board state sync), the API should return `401` and the client should redirect to `/auth/signin` with the current path as `callbackUrl`.

**Design note:** The sign-in page must accept a `callbackUrl` query param and preserve it through the OAuth flow so the user is returned to their exact board. The callback URL must be validated server-side to prevent open-redirect attacks (must be a relative URL starting with `/`, not `http://`).

---

### 6b. GitHub OAuth failure (GitHub is down, bad credentials, denied by user)

**Scenario:** The user clicks "Continue with GitHub" but GitHub returns an error — either the user clicks "Cancel" on the GitHub authorize screen, or GitHub returns an OAuth error code.

**Behavior:** GitHub redirects back to `/auth/callback?error=access_denied` (or similar). The route handler detects the `error` query param, does not create a session, and redirects to `/auth/signin?error=OAuthCallback`. The sign-in page renders the error bar with the appropriate message.

**No blank page, no unhandled exception.** The error is always caught and routed back to the sign-in page.

---

### 6c. User is removed from the whitelist while already signed in

**Scenario:** A user has a valid session but an admin removes them from the whitelist. The session cookie still exists and is technically valid.

**Behavior (two options; pick one at implementation time):**

- **Lazy invalidation (simpler):** The session remains valid until it naturally expires. On next sign-in they are denied. Acceptable for most use cases.
- **Active invalidation (stricter):** The middleware checks the whitelist on every request (reading from a cached config, not a DB hit per request). If the username is no longer present, the middleware clears the session cookie and redirects to `/auth/denied?username={login}`. This is the recommended approach for a security-sensitive workspace.

**Design:** The access-denied page is already designed to handle this case. No extra screen is needed.

---

### 6d. User visits `/auth/callback` directly with no code

**Scenario:** A user manually navigates to `/auth/callback` or bookmarks it.

**Behavior:** The route handler finds no `code` param, no matching `state`, and redirects to `/auth/signin?error=OAuthCallback`. No session is touched.

---

### 6e. User is already signed in and visits `/auth/signin`

**Scenario:** A signed-in user navigates to `/auth/signin` (e.g., via back button or bookmarked link).

**Behavior:** The middleware detects a valid session and redirects to `/` (board list). The sign-in page is never rendered for authenticated users. This prevents duplicate session creation.

---

### 6f. GitHub returns a different username than expected (renamed account)

**Scenario:** A whitelisted user renames their GitHub account after being added to the whitelist. Their new username is not on the list.

**Behavior:** They are treated as a non-whitelisted user and see the access-denied screen. The admin must update the whitelist with the new username. This is expected behavior — the whitelist is keyed on GitHub login, which is mutable.

**Copy note:** The access-denied body text shows the rejected username, making it immediately obvious to the user that the mismatch is the cause.

---

### 6g. Concurrent sign-in sessions (multiple browsers / devices)

**Scenario:** A whitelisted user signs in on two browsers simultaneously.

**Behavior:** Both sessions are valid independently. Sign-out in one browser does not affect the other (unless the implementation uses server-side session revocation by user ID, which is optional). This is standard session behavior and requires no special UX treatment.

---

*Design by: Kobani product team*
*Last updated: 2026-04-13*
