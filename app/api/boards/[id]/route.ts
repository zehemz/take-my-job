import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapBoardSummary, mapColumn, mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import { devAuth as auth } from '@/lib/dev-auth';
import { reconcileNotifications } from '@/lib/notifications';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const board = await prisma.board.findUnique({ where: { id: params.id } });
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  // Delete in FK dependency order: Notifications → AgentRuns → Cards → Columns → Board
  await prisma.notification.deleteMany({ where: { boardId: params.id } });
  await prisma.agentRun.deleteMany({ where: { card: { boardId: params.id } } });
  await prisma.card.deleteMany({ where: { boardId: params.id } });
  await prisma.column.deleteMany({ where: { boardId: params.id } });
  await prisma.board.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const board = await prisma.board.findUnique({
    where: { id: params.id },
    include: { _count: { select: { columns: true, cards: true } } },
  });
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  const [columns, cards] = await Promise.all([
    prisma.column.findMany({
      where: { boardId: params.id },
      orderBy: { position: 'asc' },
    }),
    prisma.card.findMany({
      where: { boardId: params.id },
      include: {
        agentRuns: { orderBy: { createdAt: 'asc' } },
        column: { select: { columnType: true } },
      },
      orderBy: [{ position: 'asc' }],
    }),
  ]);

  const mappedCards = cards.map((c) => {
    const mappedRuns = c.agentRuns.map(mapAgentRun);
    const agentStatus = deriveCardAgentStatus(c.agentRuns);
    return mapCard(c, mappedRuns, agentStatus, c.column.columnType);
  });

  // Fire-and-forget: reconcile notifications based on current card states
  reconcileNotifications(mappedCards).catch(() => {});

  return NextResponse.json({
    board: mapBoardSummary(board),
    columns: columns.map(mapColumn),
    cards: mappedCards,
  });
}
