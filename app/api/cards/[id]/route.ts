import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import type { UpdateCardRequest } from '@/lib/api-types';
import { auth } from '@/auth';

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
    },
  });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

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

  await prisma.card.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
}
