import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { prisma } from '@/lib/db';
import { mapCard } from '@/lib/api-mappers';
import type { CreateCardRequest } from '@/lib/api-types';
import { devAuth as auth } from '@/lib/dev-auth';
import { checkCardAccess, resolveCardEnvironment } from '@/lib/rbac';
import { promoteUnlockedCards } from '@/lib/auto-promote';
import { dbQueries } from '@/lib/db-queries';
import { run as runAgent } from '@/lib/agent-runner';
import { anthropicClient } from '@/lib/anthropic-client';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: CreateCardRequest = await req.json();
  const { title, columnId, description, acceptanceCriteria, role, githubRepo, githubBranch, requiresApproval, environmentId, dependsOn } = body;

  if (!title || !columnId) {
    return NextResponse.json({ error: 'title and columnId are required' }, { status: 400 });
  }

  if (!role) {
    return NextResponse.json({ error: 'role is required' }, { status: 400 });
  }

  // Validate role exists in AgentConfig
  const agentConfig = await prisma.agentConfig.findUnique({ where: { role } });
  if (!agentConfig) {
    return NextResponse.json({ error: `Unknown agent role: ${role}` }, { status: 400 });
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
    const envId = await resolveCardEnvironment(role, environmentId);
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
      role,
      position,
      githubRepoUrl: repoUrl,
      githubBranch: branch,
      environmentId: environmentId ?? null,
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
  // Then immediately dispatch agents for promoted cards (serverless-safe, don't rely on poll loop)
  const board = await prisma.board.findUnique({ where: { id: params.id }, select: { autoMode: true } });
  if (board?.autoMode) {
    const promotedIds = await promoteUnlockedCards(params.id);
    for (const promotedId of promotedIds) {
      const existing = await dbQueries.getActiveRunForCard(promotedId);
      if (existing) continue;
      const promoted = await dbQueries.getCard(promotedId);
      if (!promoted) continue;
      const role = promoted.role ?? 'backend-engineer';
      const agentRun = await dbQueries.createAgentRun(promotedId, promoted.columnId, role, 1);
      waitUntil(
        runAgent(promoted, agentRun, { db: dbQueries, anthropicClient })
          .catch((err) => console.error('[auto-promote] agent runner error:', err)),
      );
    }
  }

  return NextResponse.json(mapCard(card, [], 'idle', card.column.columnType), { status: 201 });
}
