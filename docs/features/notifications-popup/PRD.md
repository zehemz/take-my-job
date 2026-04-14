# Notifications Popup — PRD

## Problem

The notification bell in the top nav navigates to the `/attention` page on click. Users want to quickly glance at notifications without leaving the current page.

## Goal

Replace the bell's click-to-navigate behavior with an inline dropdown popup that shows recent notifications with read/unread tracking and a badge count.

## Requirements

1. **Bell icon badge** shows the count of unread notifications (not just attention-state cards).
2. **Click bell** opens a dropdown popup anchored to the bell — does NOT navigate away.
3. **Popup contents**:
   - Header with "Notifications" title and "Mark all read" action.
   - Scrollable list of recent notifications (up to 50).
   - Each item shows: status type color, card title (bold if unread), board name, message snippet, relative timestamp, unread dot.
   - Click a notification → opens card detail modal, marks notification as read.
   - Empty state when no notifications.
   - Footer "View all" link to `/attention` page.
4. **Click outside popup** closes it.
5. **Notifications are persisted** in the database with read/unread state.
6. **Notifications are auto-created** when cards enter attention states (blocked, evaluation-failed, pending-approval).
7. **Stale notifications** are auto-marked read when the card leaves the attention state.
8. **Polling** refreshes notifications every 10 seconds.

## Out of Scope

- Push notifications / WebSocket delivery (polling is sufficient).
- Per-user notification tracking (single-user for now).
- Notification preferences / muting.
