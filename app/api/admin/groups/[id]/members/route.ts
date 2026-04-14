import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { devAuth } from '@/lib/dev-auth';

export async function POST(
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

  const { id: groupId } = await params;
  const body = await req.json();
  const { userId } = body;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const existing = await prisma.userGroupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (existing) {
    return NextResponse.json({ error: 'User is already a member of this group' }, { status: 409 });
  }

  const membership = await prisma.userGroupMember.create({
    data: { userId, groupId },
  });

  return NextResponse.json(
    { id: membership.id, userId, groupId, createdAt: membership.createdAt.toISOString() },
    { status: 201 }
  );
}
