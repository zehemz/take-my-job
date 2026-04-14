import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import type { MoveCardRequest } from '@/lib/api-types';
import { auth } from '@/auth';

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

  // Verify the column exists
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) {
    return NextResponse.json({ error: 'Column not found' }, { status: 404 });
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
    include: { agentRuns: { orderBy: { createdAt: 'asc' } } },
  });

  const mappedRuns = card.agentRuns.map(mapAgentRun);
  const agentStatus = deriveCardAgentStatus(card.agentRuns);
  return NextResponse.json(mapCard(card, mappedRuns, agentStatus));
}
