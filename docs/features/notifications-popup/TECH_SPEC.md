# Notifications Popup — Tech Spec

## Database

New `Notification` model in Prisma:

```prisma
model Notification {
  id        String   @id @default(cuid())
  cardId    String
  boardId   String
  type      String   // 'blocked' | 'evaluation-failed' | 'pending-approval'
  message   String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  card      Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  board     Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@index([isRead, createdAt])
  @@index([cardId])
}
```

Reverse relations added to `Board` and `Card`.

## API Types (`lib/api-types.ts`)

- `NotificationType = 'blocked' | 'evaluation-failed' | 'pending-approval'`
- `ApiNotification { id, cardId, boardId, cardTitle, boardName, type, message, isRead, createdAt }`
- `NotificationsResponse { notifications: ApiNotification[]; unreadCount: number }`
- `MarkNotificationsReadRequest { notificationIds: string[] }` — empty = mark all

## API Routes

### `GET /api/notifications`
Returns last 50 notifications with card title and board name joined. Includes unread count.

### `PATCH /api/notifications`
Accepts `MarkNotificationsReadRequest`. Marks specified (or all) notifications as read.

## Notification Lifecycle

### Creation — Reconciliation pattern
`reconcileNotifications(cards)` in `lib/notifications.ts`:
1. For each card in an attention state, check for existing unread notification of same type+card.
2. Create if missing.
3. For existing unread notifications whose card is NO LONGER in that attention state, mark as read.

Called from `GET /api/boards/[id]` (piggybacks on 5-second board polling).

### Deduplication
`createNotification()` skips creation if an unread notification of same type+card already exists.

## Store (`lib/store.ts`)

New state: `notifications`, `unreadNotificationCount`, `notificationPopupOpen`.
New actions: `fetchNotifications`, `markNotificationsRead`, `markAllNotificationsRead`, `openNotificationPopup`, `closeNotificationPopup`.

## Polling

`NotificationBell.tsx` polls `fetchNotifications` every 10 seconds via `useEffect` + `setInterval`.

## Cascade Delete

`DELETE /api/boards/[id]` deletes notifications before cards to respect FK order.
