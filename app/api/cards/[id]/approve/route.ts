import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { toCardResponse } from '@/lib/api-mappers';
import { devAuth as auth } from '@/lib/dev-auth';
import { requireCardAccess } from '@/lib/rbac';
import { promoteUnlockedCards } from '@/lib/auto-promote';

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

  // Approval moves card to terminal — auto-promote dependent cards
  promoteUnlockedCards(card.boardId).catch((err) =>
    console.error('[auto-promote] error after approval:', err)
  );

  return NextResponse.json(toCardResponse(updatedCard));
}
