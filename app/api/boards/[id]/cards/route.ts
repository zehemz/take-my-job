import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapCard } from '@/lib/api-mappers';
import type { CreateCardRequest } from '@/lib/api-types';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body: CreateCardRequest = await req.json();
  const { title, columnId, description, acceptanceCriteria, role, githubRepo, githubBranch } = body;

  if (!title || !columnId) {
    return NextResponse.json({ error: 'title and columnId are required' }, { status: 400 });
  }

  // Verify board and column belong together
  const column = await prisma.column.findFirst({
    where: { id: columnId, boardId: params.id },
  });
  if (!column) {
    return NextResponse.json({ error: 'Column not found on this board' }, { status: 404 });
  }

  // Get max position in column
  const maxPos = await prisma.card.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  const position = body.position ?? (maxPos._max.position ?? -1) + 1;

  const card = await prisma.card.create({
    data: {
      boardId: params.id,
      columnId,
      title,
      description: description ?? null,
      acceptanceCriteria: acceptanceCriteria ? JSON.stringify(acceptanceCriteria) : null,
      role: role ?? null,
      position,
      githubRepoUrl: githubRepo ?? null,
      githubBranch: githubBranch ?? null,
    },
    include: { agentRuns: true },
  });

  return NextResponse.json(mapCard(card, [], 'idle'), { status: 201 });
}
