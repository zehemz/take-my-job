import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { prisma } from '@/lib/db';
import { toCardResponse } from '@/lib/api-mappers';
import { devAuth as auth } from '@/lib/dev-auth';
import { requireCardAccess } from '@/lib/rbac';
import { promoteUnlockedCards } from '@/lib/auto-promote';
import { dbQueries } from '@/lib/db-queries';
import { run as runAgent } from '@/lib/agent-runner';
import { anthropicClient } from '@/lib/anthropic-client';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch card with its full column (needed for business logic) and agent runs
  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: {
      column: true,
      agentRuns: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const forbidden = await requireCardAccess(session.user.githubUsername, card);
  if (forbidden) return forbidden;

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
      dependsOn: { select: { id: true } },
    },
  });

  // Emit orchestrator event so SSE clients are notified
  await dbQueries.insertOrchestratorEvent({
    boardId: card.boardId,
    cardId: card.id,
    type: 'card_approved',
    payload: { approvedBy: session.user.githubUsername },
  });

  // Approval moves card to terminal — auto-promote dependent cards and dispatch agents
  promoteUnlockedCards(card.boardId).then(async (promotedIds) => {
    for (const promotedId of promotedIds) {
      const existing = await dbQueries.getActiveRunForCard(promotedId);
      if (existing) continue;
      const promoted = await dbQueries.getCard(promotedId);
      if (!promoted) continue;
      const role = promoted.role ?? 'backend-engineer';
      const agentRun = await dbQueries.createAgentRun(promotedId, promoted.columnId, role, 1);
      waitUntil(
        runAgent(promoted, agentRun, { db: dbQueries, anthropicClient })
          .catch((err) => console.error('[auto-promote] agent runner error:', err)),
      );
    }
  }).catch((err) => console.error('[auto-promote] error after approval:', err));

  return NextResponse.json(toCardResponse(updatedCard));
}
