import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { devAuth } from '@/lib/dev-auth';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await devAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminUser = await prisma.user.findUnique({
    where: { githubUsername: session.user.githubUsername.toLowerCase() },
    select: { isAdmin: true },
  });
  if (!adminUser?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const group = await prisma.userGroup.findUnique({ where: { id } });
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Update name/description if provided
    const updateData: Record<string, string | null> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;

    if (Object.keys(updateData).length > 0) {
      await tx.userGroup.update({ where: { id }, data: updateData });
    }

    // Replace agent roles if provided
    if (Array.isArray(body.agentRoles)) {
      await tx.groupAgentAccess.deleteMany({ where: { groupId: id } });
      if (body.agentRoles.length > 0) {
        await tx.groupAgentAccess.createMany({
          data: body.agentRoles.map((role: string) => ({
            groupId: id,
            agentRole: role,
          })),
        });
      }
    }

    // Replace environment access if provided
    if (Array.isArray(body.environmentIds)) {
      await tx.groupEnvironmentAccess.deleteMany({ where: { groupId: id } });
      if (body.environmentIds.length > 0) {
        await tx.groupEnvironmentAccess.createMany({
          data: body.environmentIds.map((envId: string) => ({
            groupId: id,
            environmentId: envId,
          })),
        });
      }
    }
  });

  // Fetch updated group
  const updated = await prisma.userGroup.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true } },
      agentAccess: { select: { agentRole: true } },
      envAccess: { select: { environmentId: true } },
    },
  });

  return NextResponse.json({
    id: updated!.id,
    name: updated!.name,
    description: updated!.description,
    memberCount: updated!._count.members,
    agentRoles: updated!.agentAccess.map((a) => a.agentRole),
    environments: updated!.envAccess.map((e) => e.environmentId),
    createdAt: updated!.createdAt.toISOString(),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await devAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminUser = await prisma.user.findUnique({
    where: { githubUsername: session.user.githubUsername.toLowerCase() },
    select: { isAdmin: true },
  });
  if (!adminUser?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const { id } = await params;

  const group = await prisma.userGroup.findUnique({ where: { id } });
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  await prisma.userGroup.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
