# Notifications Popup — Design

## Layout

The popup is a dropdown anchored to the NotificationBell button in the TopNav. It appears below the bell, aligned to the right edge.

```
┌─────────────────────────────────────────────────┐
│  TopNav                            [🔔 3] [👤]  │
│                                    ┌──────────┐ │
│                                    │Notifs  ✓ │ │
│                                    │──────────│ │
│                                    │🔴 Card A │ │
│                                    │  Board/…  │ │
│                                    │──────────│ │
│                                    │🟣 Card B │ │
│                                    │  Board/…  │ │
│                                    │──────────│ │
│                                    │ View all │ │
│                                    └──────────┘ │
└─────────────────────────────────────────────────┘
```

## Dimensions

- Width: `w-96` (384px)
- Max height: `max-h-[28rem]` with `overflow-y-auto`
- Background: `bg-zinc-900`, border: `border-zinc-700`, rounded: `rounded-xl`
- Shadow: `shadow-2xl`

## Notification Item

Each row:
- Left: colored dot (red = blocked, rose = eval-failed, violet = pending-approval). Blue dot for unread.
- Center: card title (bold if unread, normal if read), board name in muted text, truncated message (120 chars), relative time.
- Hover: `bg-zinc-800` highlight.
- Cursor: pointer.

## Badge

- Red circle with count on the bell icon (same position as current).
- Shows unread count from API, not derived from card states.
- Hidden when count is 0.

## Interactions

- Click bell: toggle popup open/closed.
- Click notification: mark read + open card detail modal + close popup.
- Click "Mark all read": marks all unread as read, shows loading state per ADR-006.
- Click outside popup: close.
- Click "View all": navigate to `/attention`.
