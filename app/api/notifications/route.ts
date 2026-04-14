import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapNotification } from '@/lib/api-mappers';
import { devAuth as auth } from '@/lib/dev-auth';
import type { MarkNotificationsReadRequest, NotificationsResponse } from '@/lib/api-types';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        card: { select: { title: true } },
        board: { select: { name: true } },
      },
    }),
    prisma.notification.count({ where: { isRead: false } }),
  ]);

  const response: NotificationsResponse = {
    notifications: notifications.map(mapNotification),
    unreadCount,
  };

  return NextResponse.json(response);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as MarkNotificationsReadRequest;
  const { notificationIds } = body;

  if (!notificationIds || notificationIds.length === 0) {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, isRead: false },
      data: { isRead: true },
    });
  }

  const unreadCount = await prisma.notification.count({ where: { isRead: false } });
  return NextResponse.json({ unreadCount });
}
