import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapCard } from '@/lib/api-mappers';
import type { CreateCardRequest } from '@/lib/api-types';
import { devAuth as auth } from '@/lib/dev-auth';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: CreateCardRequest = await req.json();
  const { title, columnId, description, acceptanceCriteria, role, githubRepo, githubBranch, requiresApproval } = body;

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

  if (column.columnType !== 'inactive') {
    return NextResponse.json({ error: 'Cards can only be created in inactive columns' }, { status: 400 });
  }

  // Get max position in column
  const maxPos = await prisma.card.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  const position = body.position ?? (maxPos._max.position ?? -1) + 1;

  // Inherit repo from board if not explicitly provided
  let repoUrl = githubRepo ?? null;
  let branch = githubBranch ?? null;
  if (!repoUrl) {
    const board = await prisma.board.findUnique({ where: { id: params.id }, select: { githubRepo: true } });
    if (board?.githubRepo) {
      repoUrl = board.githubRepo;
      branch = branch ?? 'main';
    }
  }

  const card = await prisma.card.create({
    data: {
      boardId: params.id,
      columnId,
      title,
      description: description ?? null,
      acceptanceCriteria: acceptanceCriteria ? JSON.stringify(acceptanceCriteria) : null,
      role: role ?? null,
      position,
      githubRepoUrl: repoUrl,
      githubBranch: branch,
      requiresApproval: requiresApproval ?? false,
    },
    include: {
      agentRuns: true,
      column: { select: { columnType: true } },
    },
  });

  return NextResponse.json(mapCard(card, [], 'idle', card.column.columnType), { status: 201 });
}
