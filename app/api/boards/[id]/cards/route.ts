import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapCard } from '@/lib/api-mappers';
import type { CreateCardRequest } from '@/lib/api-types';
import { devAuth as auth } from '@/lib/dev-auth';
import { checkCardAccess, resolveCardEnvironment } from '@/lib/rbac';
import { promoteUnlockedCards } from '@/lib/auto-promote';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: CreateCardRequest = await req.json();
  const { title, columnId, description, acceptanceCriteria, role, githubRepo, githubBranch, requiresApproval, dependsOn } = body;

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

  // Validate dependsOn card IDs exist on the same board
  if (dependsOn && dependsOn.length > 0) {
    const depCards = await prisma.card.findMany({
      where: { id: { in: dependsOn }, boardId: params.id },
      select: { id: true },
    });
    const foundIds = new Set(depCards.map((c) => c.id));
    const missing = dependsOn.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `dependsOn cards not found on this board: ${missing.join(', ')}` },
        { status: 400 },
      );
    }
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
      ...(dependsOn && dependsOn.length > 0
        ? { dependsOn: { connect: dependsOn.map((id) => ({ id })) } }
        : {}),
    },
    include: {
      agentRuns: true,
      column: { select: { columnType: true } },
      dependsOn: { select: { id: true } },
    },
  });

  // After creating all cards, auto-promote any that are unlocked (no deps or all deps done)
  const board = await prisma.board.findUnique({ where: { id: params.id }, select: { autoMode: true } });
  if (board?.autoMode) {
    await promoteUnlockedCards(params.id);
  }

  return NextResponse.json(mapCard(card, [], 'idle', card.column.columnType), { status: 201 });
}
