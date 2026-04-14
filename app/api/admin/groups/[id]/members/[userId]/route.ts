import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { devAuth } from '@/lib/dev-auth';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
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

  const { id: groupId, userId } = await params;

  const membership = await prisma.userGroupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
  }

  await prisma.userGroupMember.delete({
    where: { userId_groupId: { userId, groupId } },
  });

  return new NextResponse(null, { status: 204 });
}
