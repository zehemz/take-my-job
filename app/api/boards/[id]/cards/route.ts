import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapCard } from '@/lib/api-mappers';
import type { CreateCardRequest } from '@/lib/api-types';
import { devAuth as auth } from '@/lib/dev-auth';
import { checkCardAccess, resolveCardEnvironment } from '@/lib/rbac';

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

  // RBAC check for card creation
  if (role) {
    const envId = await resolveCardEnvironment(role);
    const hasAccess = await checkCardAccess(session.user.githubUsername, role, envId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: no access to this agent role/environment' },
        { status: 403 },
      );
    }
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
      requiresApproval: requiresApproval ?? false,
    },
    include: {
      agentRuns: true,
      column: { select: { columnType: true } },
    },
  });

  return NextResponse.json(mapCard(card, [], 'idle', card.column.columnType), { status: 201 });
}
