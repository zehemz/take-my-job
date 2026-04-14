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
    select: { id: true, isAdmin: true },
  });
  if (!adminUser?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent removing admin from self if last admin
  if (body.isAdmin === false && target.id === adminUser.id) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove admin status from the last admin' },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(typeof body.isAdmin === 'boolean' ? { isAdmin: body.isAdmin } : {}),
    },
    include: {
      groupMemberships: {
        include: { group: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({
    id: updated.id,
    githubUsername: updated.githubUsername,
    isAdmin: updated.isAdmin,
    createdAt: updated.createdAt.toISOString(),
    groups: updated.groupMemberships.map((m) => m.group),
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
    select: { id: true, isAdmin: true },
  });
  if (!adminUser?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const { id } = await params;

  // Cannot delete self
  if (id === adminUser.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent deleting last admin
  if (target.isAdmin) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last admin' },
        { status: 400 }
      );
    }
  }

  await prisma.user.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
