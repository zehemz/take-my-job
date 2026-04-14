# Auth UI Design Review — Kobani

Reviewer: Designer  
Date: 2026-04-13  
Reviewing against: `docs/features/auth/DESIGN.md`

---

## 1. Component-by-Component Review

### 1a. Login page (`app/login/page.tsx`)

The implementation targets `/login` but the design spec routes all auth to `/auth/signin` (Section 3a, Section 4 component inventory). This is a **route path mismatch** — the middleware spec in Section 2a explicitly names `/auth/signin`, `/auth/callback`, and `/auth/error` as the unprotected auth paths. A page at `/login` would either be incorrectly left unprotected or require separate middleware carve-outs not in the spec.

**Layout classes — planned vs spec:**

| Property | Planned | Spec (Section 3a) | Match? |
|---|---|---|---|
| Background | `bg-zinc-950 min-h-screen flex flex-col items-center justify-center p-4` | `bg-zinc-950`, `flex items-center justify-center min-h-screen` | Partial — `flex-col` is fine, `p-4` is not specified but harmless; overall intent matches |
| Card | `bg-zinc-900 border border-zinc-800 rounded-xl p-10 w-full max-w-sm shadow-2xl` | `bg-zinc-900 border border-zinc-800 rounded-2xl p-10 w-full max-w-sm` | **FAIL** — `rounded-xl` vs spec's `rounded-2xl`; `shadow-2xl` not in spec |
| Heading | `text-2xl font-semibold text-zinc-100` | `text-xl font-semibold text-zinc-100` | **FAIL** — `text-2xl` vs spec's `text-xl` |
| Subtitle | `text-sm text-zinc-500 mt-1 mb-8` | `text-sm text-zinc-500 mt-1` | Partial — `mb-8` is placed on the subtitle; spec puts `mb-6` on the heading block container and `mb-8` on the logo/wordmark row, not the subtitle directly. Effect may be equivalent but is not spec-faithful |
| GitHub button | `w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors` | `bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-100 text-sm font-medium rounded-lg px-4 py-3 flex items-center justify-center gap-2.5 transition-colors duration-150 cursor-pointer w-full` | **FAIL** — missing `hover:border-zinc-600`, `py-2.5` vs `py-3`, `gap-2` vs `gap-2.5`, missing `duration-150`, missing `cursor-pointer` |

**Logo + wordmark:**
The spec requires the logo/wordmark to appear inside the card header (Section 3a wireframe, Section 3a copy: `flex items-center justify-center gap-2 mb-8`). The planned description says the heading is just a `"Kobani"` text string, implying the `<Image src="/logo.png" />` beside the wordmark is absent. The spec explicitly calls for `<Image src="/logo.png" width={32} height={34} />` paired with the Kobani wordmark in `text-xl font-semibold`. If only the text heading is rendered, this deviates from spec.

**Error bar:**
Planned: a `text-sm text-red-400 text-center mb-4` paragraph above the button.  
Spec (Section 3a): `bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300` with `animate-in fade-in`.  
This is a **significant deviation** — the spec calls for a styled alert bar component (`AuthErrorBar`), not a bare text node. The color is also wrong: `text-red-400` vs spec's `text-red-300` on a `bg-red-950` background.

---

### 1b. Unauthorized page (`app/unauthorized/page.tsx`)

The implementation targets `/unauthorized` but the spec names the route `/auth/denied` (Section 3b, Section 4 component inventory, Section 2d flow). Same route path mismatch issue as the login page.

**Spec deviations — planned vs spec:**

| Property | Planned | Spec (Section 3b) | Match? |
|---|---|---|---|
| Card | Same card layout (inherited from login review) | `bg-zinc-900 border border-zinc-800 rounded-2xl p-10 w-full max-w-sm` | **FAIL** — same `rounded-xl` vs `rounded-2xl` issue |
| Heading | "Access restricted" | `Access denied` | **FAIL** — copy mismatch (see Section 5 below) |
| Lock emoji in heading | Present | Not in spec | **FAIL** — spec explicitly avoids apology/decorative language; an emoji on the denial screen violates the "errors are honest, not apologetic" principle (Section 1) |
| GitHub username shown | "No username shown" | `@{login}` rendered in `text-zinc-300 font-mono`, passed via `?username=` query param | **FAIL** — spec requires the rejected username to be shown (Section 3b, Section 2d, Section 5 copy table); omitting it breaks the user's ability to understand which account was rejected |
| No GitHub mention | Correct | Correct | Pass |
| Button label | Not specified in brief | `Try a different account` | Cannot confirm match — see copy section |
| Body text | Neutral copy (unspecified in brief) | Specific copy: `@{login} is not on the Kobani access list. Contact your workspace admin to request access.` | Cannot confirm match without seeing implementation; high risk of deviation |

---

### 1c. UserMenu update

**Avatar trigger — planned vs spec:**

| Property | Planned | Spec (Section 3c) | Match? |
|---|---|---|---|
| Avatar size | Implied `w-7 h-7` (matches existing stub) | `w-7 h-7 rounded-full overflow-hidden` | Pass |
| Hover ring | Not described in brief | `ring-2 ring-transparent hover:ring-zinc-600 transition-all duration-150` | **MISSING** — hover ring state not mentioned in planned implementation |
| Avatar image | Real avatar image or initials from `githubUsername` | `<Image src={avatarUrl} />`, fallback to initials with `bg-indigo-600` | Acceptable — intent matches but prop name should be `login` / `avatarUrl` per spec's `user: { login: string; avatarUrl: string; name?: string }` interface. If the prop is called `githubUsername` instead, it is a minor naming deviation |

**Dropdown — planned vs spec:**

| Property | Planned | Spec (Section 3c) | Match? |
|---|---|---|---|
| Dropdown panel classes | Not specified in brief | `absolute top-10 right-0 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl shadow-black/40 py-1 z-50` | Cannot confirm |
| Username display | `@username` | `@{login}`, `text-xs text-zinc-400 px-3 py-2`, not clickable | Cannot confirm from brief alone |
| Divider | "Divider" mentioned | `<hr className="border-zinc-800 my-0.5" />` | Cannot confirm style |
| Sign out item | "Sign out" | `text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 px-3 py-2 cursor-pointer` | Cannot confirm from brief alone |
| Click-outside dismissal | Not mentioned | Required (Section 3c) | **MISSING** — close-on-outside-click behavior not addressed in planned implementation |

---

## 2. Tailwind Class Corrections Required

The following corrections are required before implementation is approved:

**Login/Sign-in page:**

1. **Route:** Change `app/login/page.tsx` → `app/auth/signin/page.tsx`
2. **Card border-radius:** `rounded-xl` → `rounded-2xl`
3. **Card shadow:** Remove `shadow-2xl` (not in spec)
4. **Heading size:** `text-2xl` → `text-xl`
5. **GitHub button vertical padding:** `py-2.5` → `py-3`
6. **GitHub button gap:** `gap-2` → `gap-2.5`
7. **GitHub button transition:** `transition-colors` → `transition-colors duration-150`
8. **GitHub button:** Add `cursor-pointer`
9. **GitHub button:** Add `hover:border-zinc-600` on the border
10. **Error display:** Replace bare `text-sm text-red-400 text-center mb-4` paragraph with full `AuthErrorBar` component using `bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300 animate-in fade-in`

**Unauthorized/Access Denied page:**

11. **Route:** Change `app/unauthorized/page.tsx` → `app/auth/denied/page.tsx`
12. **Card border-radius:** `rounded-xl` → `rounded-2xl` (same correction as above)
13. **Remove lock emoji** from heading — violates design principles
14. **Add username display:** Read `?username=` from search params, render `@{login}` in `text-zinc-300 font-mono`

**UserMenu:**

15. **Add hover ring to avatar trigger:** `ring-2 ring-transparent hover:ring-zinc-600 transition-all duration-150`
16. **Implement click-outside dismissal** for dropdown

---

## 3. Missing Visual States

### Loading state
The button loading state is partially addressed (the brief mentions a "Redirecting to GitHub..." label change), but the following specifics must be confirmed:
- GitHub SVG mark is replaced by the spinner from `AgentStatusBadge` (not just a text label change)
- Button gets `opacity-60 cursor-not-allowed pointer-events-none` — the brief does not mention the opacity or pointer-events changes, only the label. These must be present.

### Error state
The error bar is substantially wrong (see Section 2 above). Additionally:
- The `animate-in fade-in` entrance animation is missing from the planned implementation
- The error bar must render nothing when no `?error=` param is present (conditional rendering) — `AuthErrorBar` should accept `error: string | null`

### Focus states
Neither the login page nor the unauthorized page brief mentions `:focus-visible` outlines on the button. The GitHub button needs a visible focus ring for keyboard navigability. Recommended: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900`.

### UserMenu dropdown open/closed state
The brief mentions the dropdown but does not address:
- Keyboard accessibility (`Escape` to close)
- The avatar trigger's active/pressed state while dropdown is open (spec is silent on this, but an `aria-expanded` attribute is still required)

### Hover on "Try a different account" button (Access Denied page)
The spec says the button uses the "same surface-action style as the GitHub button" — which includes `hover:bg-zinc-700 hover:border-zinc-600 transition-colors duration-150`. The brief does not confirm these hover states are implemented.

---

## 4. Copy Review

### Sign-in page

| Element | Planned | Spec (Section 5) | Match? |
|---|---|---|---|
| Heading | `"Kobani"` (implied, as the card heading) | `Sign in to continue` | **FAIL** — "Kobani" is the wordmark, not the page heading. The h1 must be `Sign in to continue` |
| Subtitle | Described as "subtitle" (exact text not confirmed in brief) | `This workspace is invite-only.` | Cannot confirm — must be verified in implementation |
| Button (default) | `Continue with GitHub` (implied by "GitHub button") | `Continue with GitHub` | Pass (assumed) |
| Button (loading) | `Redirecting to GitHub...` | `Redirecting to GitHub...` | Pass |
| Page title | Not mentioned in brief | `Sign in — Kobani` | **MISSING** — `<title>` not addressed |

### Access Denied page

| Element | Planned | Spec (Section 5) | Match? |
|---|---|---|---|
| Heading | `Access restricted` | `Access denied` | **FAIL** — exact copy mismatch |
| Body copy | "Neutral copy" (unspecified) | `@{login} is not on the Kobani access list. Contact your workspace admin to request access.` | **UNCONFIRMED** — high risk |
| Fallback body (no username) | Not addressed | `Your GitHub account is not on the Kobani access list. Contact your workspace admin to request access.` | **MISSING** |
| Button | Not specified in brief | `Try a different account` | Cannot confirm |
| Page title | Not mentioned in brief | `Access denied — Kobani` | **MISSING** |

### UserMenu dropdown

| Element | Planned | Spec (Section 5) | Match? |
|---|---|---|---|
| Username row | `@username` | `@{login}` | Pass (intent matches) |
| Sign-out item | `Sign out` | `Sign out` | Pass |

---

## 5. Overall Verdict

**⚠️ Approved with changes**

The implementation is broadly aligned with the design intent — zinc palette, card-based auth screens, GitHub OAuth entry point, and the UserMenu dropdown pattern are all correct conceptual approaches. However, there are enough specific deviations that the implementation cannot ship as described in the brief without corrections.

**Blocking issues (must fix before merge):**

1. Route paths are wrong: `/login` and `/unauthorized` must be `/auth/signin` and `/auth/denied`
2. Card corner radius: `rounded-xl` → `rounded-2xl` on both auth pages
3. Heading copy on access denied: `"Access restricted"` → `"Access denied"`
4. Heading on sign-in: the h1 must be `"Sign in to continue"`, not the wordmark `"Kobani"`
5. Lock emoji must be removed from the access denied page
6. Username must be shown on the access denied page (read from `?username=` query param, render in `text-zinc-300 font-mono`)
7. Error display: replace the bare text node with the `AuthErrorBar` component (`bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300 animate-in fade-in`)
8. Logo + wordmark (`<Image>` beside "Kobani") must appear as the card header on both auth pages

**Non-blocking but required before QA:**

- GitHub button: `py-2.5` → `py-3`, `gap-2` → `gap-2.5`, add `hover:border-zinc-600`, `duration-150`, `cursor-pointer`
- Button loading state: confirm spinner SVG replaces icon, `opacity-60 cursor-not-allowed pointer-events-none` applied
- UserMenu avatar: add `ring-2 ring-transparent hover:ring-zinc-600 transition-all duration-150`
- UserMenu dropdown: add click-outside dismissal
- Add `focus-visible` ring to interactive buttons on auth pages
- Page `<title>` tags: `Sign in — Kobani` and `Access denied — Kobani`
- Confirm fallback body copy on access denied page (no username case)
