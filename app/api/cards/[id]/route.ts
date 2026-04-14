import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import type { UpdateCardRequest } from '@/lib/api-types';
import { devAuth as auth } from '@/lib/dev-auth';
import { guardCardAccess } from '@/lib/rbac';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: {
      agentRuns: { orderBy: { createdAt: 'asc' } },
      column: { select: { columnType: true } },
      dependsOn: { select: { id: true } },
    },
  });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  // RBAC check
  const hasAccess = await guardCardAccess(session.user.githubUsername, card);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this agent role/environment' },
      { status: 403 },
    );
  }

  const mappedRuns = card.agentRuns.map(mapAgentRun);
  const agentStatus = deriveCardAgentStatus(card.agentRuns);
  return NextResponse.json(mapCard(card, mappedRuns, agentStatus, card.column.columnType));
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

  // RBAC check
  const hasAccessPatch = await guardCardAccess(session.user.githubUsername, existing);
  if (!hasAccessPatch) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this agent role/environment' },
      { status: 403 },
    );
  }

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

  const mappedRuns = card.agentRuns.map(mapAgentRun);
  const agentStatus = deriveCardAgentStatus(card.agentRuns);
  return NextResponse.json(mapCard(card, mappedRuns, agentStatus, card.column.columnType));
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
    select: { role: true },
  });
  if (!cardToDelete) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  // RBAC check
  const hasAccessDelete = await guardCardAccess(session.user.githubUsername, cardToDelete);
  if (!hasAccessDelete) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this agent role/environment' },
      { status: 403 },
    );
  }

  await prisma.agentRun.deleteMany({ where: { cardId: params.id } });
  await prisma.card.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
}
