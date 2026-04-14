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

  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: { agentRuns: { orderBy: { createdAt: 'desc' } } },
  });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const latestRun = card.agentRuns[0] ?? null;

  // Not retryable if no runs exist or card is currently active
  if (!latestRun) {
    return NextResponse.json({ error: 'Card is not in a retryable state' }, { status: 400 });
  }

  const activeStatuses = new Set(['running', 'evaluating', 'idle', 'pending']);
  if (activeStatuses.has(latestRun.status)) {
    return NextResponse.json({ error: 'Card is not in a retryable state' }, { status: 400 });
  }

  if (latestRun.retryAfterMs !== null) {
    // Scheduled retry waiting — accelerate to now
    await prisma.agentRun.update({
      where: { id: latestRun.id },
      data: { retryAfterMs: BigInt(Date.now()) },
    });
  } else if (latestRun.status === 'failed') {
    // Permanently failed — create a fresh run at attempt 1
    await prisma.agentRun.create({
      data: {
        cardId: card.id,
        role: latestRun.role,
        status: 'pending',
        attempt: 1,
      },
    });
  } else {
    return NextResponse.json({ error: 'Card is not in a retryable state' }, { status: 400 });
  }

  // Re-fetch card with updated runs and return ApiCard
  const updated = await prisma.card.findUnique({
    where: { id: params.id },
    include: { agentRuns: { orderBy: { createdAt: 'asc' } } },
  });
  if (!updated) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const mappedRuns = updated.agentRuns.map(mapAgentRun);
  const agentStatus = deriveCardAgentStatus(updated.agentRuns);
  return NextResponse.json(mapCard(updated, mappedRuns, agentStatus));
}
