import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import type { RequestRevisionRequest } from '@/lib/api-types';
import { devAuth as auth } from '@/lib/dev-auth';

export async function POST(
  req: Request,
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

  // Find the revision column on this board
  const revisionCol = await prisma.column.findFirst({
    where: { boardId: card.boardId, columnType: 'revision' },
  });
  if (!revisionCol) {
    return NextResponse.json(
      { error: 'No revision column on this board' },
      { status: 409 },
    );
  }

  const body: RequestRevisionRequest = await req.json();
  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim() === '') {
    return NextResponse.json(
      { error: 'reason is required and must be a non-empty string' },
      { status: 400 },
    );
  }

  const updatedCard = await prisma.card.update({
    where: { id: params.id },
    data: {
      columnId: revisionCol.id,
      revisionContextNote: body.reason,
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
