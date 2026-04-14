import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { prisma } from '@/lib/db';
import { deriveCardAgentStatus, toCardResponse } from '@/lib/api-mappers';
import type { MoveCardRequest } from '@/lib/api-types';
import { VALID_TRANSITIONS } from '@/lib/kanban-types';
import { devAuth as auth } from '@/lib/dev-auth';
import { requireCardAccess } from '@/lib/rbac';
import { orchestrator } from '@/lib/orchestrator-instance';
import { run as runAgent } from '@/lib/agent-runner';
import { dbQueries } from '@/lib/db-queries';
import { anthropicClient } from '@/lib/anthropic-client';
import { promoteUnlockedCards } from '@/lib/auto-promote';

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

  // Ensure the target column belongs to the same board as the card
  if (targetColumn.boardId !== existingCard.column.boardId) {
    return NextResponse.json(
      { error: 'Target column does not belong to the same board as the card' },
      { status: 400 },
    );
  }

  const forbidden = await requireCardAccess(session.user.githubUsername, existingCard);
  if (forbidden) return forbidden;

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
      dependsOn: { select: { id: true } },
    },
  });

  await orchestrator.notifyCardMoved(params.id, columnId);

  // Serverless-safe immediate dispatch: don't wait for the poll loop tick.
  // waitUntil keeps the function alive after the response so the agent
  // event stream can run to completion (or until Vercel's function timeout).
  if (targetColumn.isActiveState) {
    const existing = await dbQueries.getActiveRunForCard(params.id);
    if (!existing) {
      const role = existingCard.role ?? 'backend-engineer';
      const agentRun = await dbQueries.createAgentRun(params.id, columnId, role, 1);
      const cardWithColumn = await dbQueries.getCard(params.id);
      if (cardWithColumn) {
        waitUntil(
          runAgent(cardWithColumn, agentRun, { db: dbQueries, anthropicClient })
            .catch((err) => console.error('[move] agent runner error:', err)),
        );
      }
    }
  }

  // If card moved to terminal column, auto-promote dependent cards and dispatch agents
  if (targetColumn.isTerminalState) {
    promoteUnlockedCards(existingCard.boardId).then(async (promotedIds) => {
      for (const promotedId of promotedIds) {
        const existingRun = await dbQueries.getActiveRunForCard(promotedId);
        if (existingRun) continue;
        const promoted = await dbQueries.getCard(promotedId);
        if (!promoted) continue;
        const promotedRole = promoted.role ?? 'backend-engineer';
        const agentRun = await dbQueries.createAgentRun(promotedId, promoted.columnId, promotedRole, 1);
        waitUntil(
          runAgent(promoted, agentRun, { db: dbQueries, anthropicClient })
            .catch((err) => console.error('[auto-promote] agent runner error:', err)),
        );
      }
    }).catch((err) => console.error('[auto-promote] error after manual move:', err));
  }

  return NextResponse.json(toCardResponse(card));
}
