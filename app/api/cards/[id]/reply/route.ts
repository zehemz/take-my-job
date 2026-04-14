import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import { devAuth as auth } from '@/lib/dev-auth';
import { anthropicClient } from '@/lib/anthropic-client';
import { orchestrator } from '@/lib/orchestrator-instance';
import type { CardReplyRequest } from '@/lib/api-types';
import type { AgentRun } from '@/lib/types';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as CardReplyRequest;
  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: {
      column: true,
      agentRuns: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  if (card.column.columnType !== 'blocked') {
    return NextResponse.json({ error: 'Card is not blocked' }, { status: 400 });
  }

  const blockedRun = card.agentRuns.find((r) => r.status === 'blocked' && r.sessionId);
  if (!blockedRun) {
    return NextResponse.json({ error: 'No active blocked session found' }, { status: 409 });
  }

  // Find the active column to move the card back to
  const activeCol = await prisma.column.findFirst({
    where: { boardId: card.boardId, columnType: 'active' },
  });
  if (!activeCol) {
    return NextResponse.json({ error: 'No active column on this board' }, { status: 409 });
  }

  // 1. Send human reply to the live Anthropic session
  await anthropicClient.sendMessage(blockedRun.sessionId!, {
    type: 'user.message',
    content: body.message.trim(),
  });

  // 2. Update run status back to running and move card to active
  const [updatedRun] = await Promise.all([
    prisma.agentRun.update({
      where: { id: blockedRun.id },
      data: { status: 'running', blockedReason: null },
    }),
    prisma.card.update({
      where: { id: card.id },
      data: { columnId: activeCol.id, movedToColumnAt: new Date() },
    }),
  ]);

  // 3. Re-attach event loop so agent output is streamed and card is moved on completion
  await orchestrator.notifyCardUnblocked(card.id, updatedRun as unknown as AgentRun);

  // Return updated card
  const updated = await prisma.card.findUnique({
    where: { id: params.id },
    include: {
      agentRuns: { orderBy: { createdAt: 'asc' } },
      column: { select: { columnType: true } },
    },
  });
  if (!updated) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const mappedRuns = updated.agentRuns.map(mapAgentRun);
  const agentStatus = deriveCardAgentStatus(updated.agentRuns);
  return NextResponse.json(mapCard(updated, mappedRuns, agentStatus, updated.column.columnType));
}
