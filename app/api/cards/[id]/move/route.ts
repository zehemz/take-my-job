import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import type { MoveCardRequest } from '@/lib/api-types';
import { VALID_TRANSITIONS } from '@/lib/kanban-types';
import { devAuth as auth } from '@/lib/dev-auth';
import { guardCardAccess } from '@/lib/rbac';
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

  // Fetch the card's current column + agent runs to validate the transition
  const existingCard = await prisma.card.findUnique({
    where: { id: params.id },
    include: { column: true, agentRuns: { orderBy: { createdAt: 'asc' } } },
  });
  if (!existingCard) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  // RBAC check
  try {
    const hasAccess = await guardCardAccess(session.user.githubUsername, existingCard);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: no access to this agent role/environment' },
        { status: 403 },
      );
    }
  } catch (rbacErr) {
    console.error('[move] RBAC check failed, allowing as fallback:', rbacErr);
  }

  const fromType = existingCard.column.columnType;
  const toType = targetColumn.columnType;

  const allowed = VALID_TRANSITIONS[fromType] ?? [];
  if (!allowed.includes(toType)) {
    return NextResponse.json(
      { error: `Invalid column transition: ${fromType} → ${toType}` },
      { status: 400 },
    );
  }

  // active → review: agent must have completed with all criteria passing
  if (fromType === 'active' && toType === 'review') {
    const agentStatus = deriveCardAgentStatus(existingCard.agentRuns);
    if (agentStatus !== 'completed') {
      return NextResponse.json(
        { error: 'Card can only move to review after the agent completes with all criteria passing.' },
        { status: 400 },
      );
    }
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
