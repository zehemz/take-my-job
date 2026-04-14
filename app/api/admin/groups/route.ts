import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { devAuth } from '@/lib/dev-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await devAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminUser = await prisma.user.findUnique({
    where: { githubUsername: session.user.githubUsername.toLowerCase() },
    select: { isAdmin: true },
  });
  if (!adminUser?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const groups = await prisma.userGroup.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: true } },
      agentAccess: { select: { agentRole: true } },
      envAccess: { select: { environmentId: true } },
    },
  });

  const rows = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    memberCount: g._count.members,
    agentRoles: g.agentAccess.map((a) => a.agentRole),
    environments: g.envAccess.map((e) => e.environmentId),
    createdAt: g.createdAt.toISOString(),
  }));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await devAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminUser = await prisma.user.findUnique({
    where: { githubUsername: session.user.githubUsername.toLowerCase() },
    select: { isAdmin: true },
  });
  if (!adminUser?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, agentRoles, environmentIds } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
  }

  if (!Array.isArray(agentRoles) || agentRoles.length === 0) {
    return NextResponse.json({ error: 'At least one agent role is required' }, { status: 400 });
  }

  if (!Array.isArray(environmentIds) || environmentIds.length === 0) {
    return NextResponse.json({ error: 'At least one environment is required' }, { status: 400 });
  }

  const existing = await prisma.userGroup.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: 'Group name already exists' }, { status: 409 });
  }

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.userGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    await tx.groupAgentAccess.createMany({
      data: agentRoles.map((role: string) => ({
        groupId: g.id,
        agentRole: role,
      })),
    });

    await tx.groupEnvironmentAccess.createMany({
      data: environmentIds.map((envId: string) => ({
        groupId: g.id,
        environmentId: envId,
      })),
    });

    return g;
  });

  return NextResponse.json(
    {
      id: group.id,
      name: group.name,
      description: group.description,
      memberCount: 0,
      agentRoles,
      environments: environmentIds,
      createdAt: group.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
