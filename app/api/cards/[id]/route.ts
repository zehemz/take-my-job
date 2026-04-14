import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { toCardResponse } from '@/lib/api-mappers';
import type { UpdateCardRequest } from '@/lib/api-types';
import { devAuth as auth } from '@/lib/dev-auth';
import { requireCardAccess } from '@/lib/rbac';
import { getCardForApi } from '@/lib/db-queries';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const card = await getCardForApi(params.id);
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const forbidden = await requireCardAccess(session.user.githubUsername, card);
  if (forbidden) return forbidden;

  return NextResponse.json(toCardResponse(card));
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: UpdateCardRequest = await req.json();

  // Only allow edits while the card is in the backlog (inactive column)
  const existing = await prisma.card.findUnique({
    where: { id: params.id },
    include: { column: { select: { columnType: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const forbidden = await requireCardAccess(session.user.githubUsername, existing);
  if (forbidden) return forbidden;

  if (existing.column.columnType !== 'inactive') {
    return NextResponse.json(
      { error: 'Cards can only be edited while in the backlog' },
      { status: 403 },
    );
  }

  const card = await prisma.card.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.acceptanceCriteria !== undefined && {
        acceptanceCriteria: JSON.stringify(body.acceptanceCriteria),
      }),
      ...(body.role !== undefined && { role: body.role }),
      ...(body.githubRepo !== undefined && { githubRepoUrl: body.githubRepo }),
      ...(body.githubBranch !== undefined && { githubBranch: body.githubBranch }),
      ...(body.environmentId !== undefined && { environmentId: body.environmentId }),
      ...(body.revisionContextNote !== undefined && {
        revisionContextNote: body.revisionContextNote,
      }),
      ...(body.approvedBy !== undefined && {
        approvedBy: session.user.githubUsername, // NEVER trust the client-supplied value
        approvedAt: new Date(),
      }),
    },
    include: {
      agentRuns: { orderBy: { createdAt: 'asc' } },
      column: { select: { columnType: true } },
      dependsOn: { select: { id: true } },
    },
  });

  return NextResponse.json(toCardResponse(card));
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch card for RBAC check
  const cardToDelete = await prisma.card.findUnique({
    where: { id: params.id },
    select: { role: true, environmentId: true },
  });
  if (!cardToDelete) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const forbidden = await requireCardAccess(session.user.githubUsername, cardToDelete);
  if (forbidden) return forbidden;

  await prisma.agentRun.deleteMany({ where: { cardId: params.id } });
  await prisma.card.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
}
