import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapBoardSummary, mapColumn, mapAgentRun, mapCard, deriveCardAgentStatus } from '@/lib/api-mappers';
import { devAuth as auth } from '@/lib/dev-auth';
import { reconcileNotifications } from '@/lib/notifications';
import { resolvePermissions, resolveCardEnvironment } from '@/lib/rbac';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const board = await prisma.board.findUnique({ where: { id: params.id } });
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.autoMode === 'boolean') data.autoMode = body.autoMode;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await prisma.board.update({
    where: { id: params.id },
    data,
    include: { _count: { select: { columns: true, cards: true } } },
  });

  return NextResponse.json(mapBoardSummary(updated));
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const board = await prisma.board.findUnique({ where: { id: params.id } });
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  // Delete in FK dependency order: Notifications → AgentRuns → Cards → Columns → Board
  await prisma.notification.deleteMany({ where: { boardId: params.id } });
  await prisma.agentRun.deleteMany({ where: { card: { boardId: params.id } } });
  await prisma.card.deleteMany({ where: { boardId: params.id } });
  await prisma.column.deleteMany({ where: { boardId: params.id } });
  await prisma.board.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const board = await prisma.board.findUnique({
    where: { id: params.id },
    include: { _count: { select: { columns: true, cards: true } } },
  });
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  const [columns, cards] = await Promise.all([
    prisma.column.findMany({
      where: { boardId: params.id },
      orderBy: { position: 'asc' },
    }),
    prisma.card.findMany({
      where: { boardId: params.id },
      include: {
        agentRuns: { orderBy: { createdAt: 'asc' } },
        column: { select: { columnType: true } },
        dependsOn: { select: { id: true } },
      },
      orderBy: [{ position: 'asc' }],
    }),
  ]);

  // Resolve RBAC permissions for the current user
  const perms = await resolvePermissions(session.user.githubUsername);

  // Build a cache of role → environmentId to avoid repeated DB lookups
  const uniqueRoles = [...new Set(cards.map((c) => c.role).filter(Boolean))] as string[];
  const envByRole = new Map<string, string | null>();
  await Promise.all(
    uniqueRoles.map(async (role) => {
      envByRole.set(role, await resolveCardEnvironment(role));
    }),
  );

  function canUserInteract(card: { role: string | null }): boolean {
    if (!perms) return false;
    if (perms.isAdmin) return true;
    if (!card.role) return true; // cards with no role are accessible to all

    const roleOk = perms.allowedAgentRoles === null || perms.allowedAgentRoles.has(card.role);
    const envId = envByRole.get(card.role) ?? null;
    const envOk = !envId || perms.allowedEnvironments === null || perms.allowedEnvironments.has(envId);
    return roleOk && envOk;
  }

  const mappedCards = cards.map((c) => {
    const mappedRuns = c.agentRuns.map(mapAgentRun);
    const agentStatus = deriveCardAgentStatus(c.agentRuns);
    return mapCard(c, mappedRuns, agentStatus, c.column.columnType, canUserInteract(c));
  });

  // Fire-and-forget: reconcile notifications based on current card states
  reconcileNotifications(mappedCards).catch(() => {});

  return NextResponse.json({
    board: mapBoardSummary(board),
    columns: columns.map(mapColumn),
    cards: mappedCards,
  });
}
