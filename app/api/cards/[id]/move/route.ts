import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import type { MoveCardRequest } from '@/lib/api-types';
import { auth } from '@/auth';
import { orchestrator } from '@/lib/orchestrator-instance';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: MoveCardRequest = await req.json();
  const { columnId, position } = body;

  if (!columnId) {
    return NextResponse.json({ error: 'columnId is required' }, { status: 400 });
  }

  // Verify the target column exists
  const targetColumn = await prisma.column.findUnique({ where: { id: columnId } });
  if (!targetColumn) {
    return NextResponse.json({ error: 'Column not found' }, { status: 404 });
  }

  // Fetch the card's current column to validate the transition
  const existingCard = await prisma.card.findUnique({
    where: { id: params.id },
    include: { column: true },
  });
  if (!existingCard) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const VALID_TRANSITIONS: Record<string, string[]> = {
    inactive: ['active'],
    active: ['active', 'review', 'revision'],
    review: ['terminal', 'revision'],
    revision: ['active'],
    terminal: [],
  };

  const allowed = VALID_TRANSITIONS[existingCard.column.columnType] ?? [];
  if (!allowed.includes(targetColumn.columnType)) {
    return NextResponse.json(
      { error: `Invalid column transition: ${existingCard.column.columnType} → ${targetColumn.columnType}` },
      { status: 400 },
    );
  }

  // Compute position if not provided
  let targetPosition = position;
  if (targetPosition === undefined) {
    const maxPos = await prisma.card.aggregate({
      where: { columnId },
      _max: { position: true },
    });
    targetPosition = (maxPos._max.position ?? -1) + 1;
  }

  const card = await prisma.card.update({
    where: { id: params.id },
    data: {
      columnId,
      position: targetPosition,
      movedToColumnAt: new Date(),
    },
    include: {
      agentRuns: { orderBy: { createdAt: 'asc' } },
      column: { select: { columnType: true } },
    },
  });

  await orchestrator.notifyCardMoved(params.id, columnId);

  const mappedRuns = card.agentRuns.map(mapAgentRun);
  const agentStatus = deriveCardAgentStatus(card.agentRuns);
  return NextResponse.json(mapCard(card, mappedRuns, agentStatus, card.column.columnType));
}
