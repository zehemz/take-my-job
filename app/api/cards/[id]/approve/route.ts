import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import { auth } from '@/auth';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch card with its column and agent runs
  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: {
      column: true,
      agentRuns: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  if (card.column.columnType !== 'review') {
    return NextResponse.json(
      { error: 'Card is not in a review column' },
      { status: 400 },
    );
  }

  // Find the terminal column on this board
  const terminalCol = await prisma.column.findFirst({
    where: { boardId: card.boardId, columnType: 'terminal' },
  });
  if (!terminalCol) {
    return NextResponse.json(
      { error: 'No terminal column on this board' },
      { status: 409 },
    );
  }

  // Update the card — approvedBy NEVER from request body
  const updatedCard = await prisma.card.update({
    where: { id: params.id },
    data: {
      columnId: terminalCol.id,
      approvedBy: session.user.githubUsername,
      approvedAt: new Date(),
      movedToColumnAt: new Date(),
    },
    include: {
      agentRuns: { orderBy: { createdAt: 'asc' } },
      column: { select: { columnType: true } },
    },
  });

  const mappedRuns = updatedCard.agentRuns.map(mapAgentRun);
  const agentStatus = deriveCardAgentStatus(updatedCard.agentRuns);
  return NextResponse.json(mapCard(updatedCard, mappedRuns, agentStatus, updatedCard.column.columnType));
}
