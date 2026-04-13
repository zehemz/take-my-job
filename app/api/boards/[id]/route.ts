import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapBoardSummary, mapColumn, mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const board = await prisma.board.findUnique({ where: { id: params.id } });
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  const [columns, cards] = await Promise.all([
    prisma.column.findMany({
      where: { boardId: params.id },
      orderBy: { position: 'asc' },
    }),
    prisma.card.findMany({
      where: { boardId: params.id },
      include: { agentRuns: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ position: 'asc' }],
    }),
  ]);

  return NextResponse.json({
    board: mapBoardSummary(board),
    columns: columns.map(mapColumn),
    cards: cards.map((c) => {
      const mappedRuns = c.agentRuns.map(mapAgentRun);
      const agentStatus = deriveCardAgentStatus(c.agentRuns);
      return mapCard(c, mappedRuns, agentStatus);
    }),
  });
}
