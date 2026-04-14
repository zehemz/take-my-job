# ADR-006 — Mutation Loading States

**Status:** Accepted

---

## Context

Without loading indicators, any button that triggers an async operation (create, delete, retry, approve, move) can be clicked multiple times before the first request completes. This produces duplicate API calls, duplicate DB records, and confusing UI flicker.

The bug that prompted this decision: the "Create Card" and "Delete card" buttons had no disabled/loading state, allowing users to submit multiple requests in rapid succession.

---

## Decision

Every button that triggers a mutation (any async write to the server) must follow this pattern:

1. **Disabled while in-flight** — set `disabled={loading}` on the button as soon as the request starts.
2. **Label changes to reflect progress** — replace the label with an ellipsis form while loading (e.g. `'Creating…'`, `'Deleting…'`, `'Retrying…'`). Never leave the original label visible while the button is disabled.
3. **Backdrop / surrounding close actions blocked** — modals must not be dismissable (backdrop click, close button, cancel) while a mutation is in-flight, to prevent closing before the response arrives.
4. **`finally` always clears loading** — use `try/finally` so loading is always reset even on error, leaving the UI in a recoverable state.

### Required classes on disabled buttons

```
disabled:opacity-60 disabled:cursor-not-allowed
```

### Example shape

```tsx
const [loading, setLoading] = useState(false);

async function handleSubmit() {
  if (loading) return;          // guard against programmatic double-calls
  setLoading(true);
  try {
    await doMutation();
  } finally {
    setLoading(false);
  }
}

<button disabled={loading} onClick={handleSubmit}>
  {loading ? 'Saving…' : 'Save'}
</button>
```

---

## Scope

This rule applies to **all** interactive mutations in the app:

- Card creation (`NewCardModal`)
- Card deletion (`CardDetailModal`)
- Board deletion (`DeleteBoardModal`)
- Card retry (`RetrySchedulePanel`)
- Card approve / request-revision
- Any future mutation buttons

---

## Consequences

- Duplicate submissions are impossible at the UI layer.
- Users get immediate feedback that their action was received.
- The pattern is uniform — reviewers can catch violations at code review time.
