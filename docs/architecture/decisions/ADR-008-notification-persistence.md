# ADR-008 — Notification persistence via DB table with reconciliation

## Status

Accepted

## Context

The notification bell needs read/unread tracking to show a proper badge and allow users to dismiss notifications. Card attention states (blocked, evaluation-failed, pending-approval) are derived from AgentRun data, but "has the user seen this?" is a separate concern that requires its own persistence.

## Decision

Use a `Notification` database table rather than deriving notifications purely from card state. Notifications are created via a **reconciliation pattern**: the `GET /api/boards/[id]` handler (already polled every 5s) scans cards for attention states and creates missing notifications. Stale notifications (card left the attention state) are auto-marked read.

## Rationale

- **Pure derivation** (no DB table) cannot track read/unread state — every poll would show the same items as "new."
- **Eager creation** (only at state-change code paths) is fragile — multiple code paths can lead to attention states, and missing one means missing notifications.
- **Reconciliation** is idempotent, catches all paths, and piggybacks on existing polling with no new infrastructure.

## Consequences

- Small additional DB load per board poll (one query to check existing notifications + conditional inserts).
- Notifications are eventually consistent (up to ~5s delay from state change).
- When multi-user auth ships, the table will need a `userId` column and per-user read tracking.
