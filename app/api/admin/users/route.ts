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

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      groupMemberships: {
        include: {
          group: { select: { id: true, name: true } },
        },
      },
    },
  });

  const rows = users.map((u) => ({
    id: u.id,
    githubUsername: u.githubUsername,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString(),
    groups: u.groupMemberships.map((m) => m.group),
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
  const { githubUsername, isAdmin: makeAdmin } = body;

  if (!githubUsername || typeof githubUsername !== 'string') {
    return NextResponse.json({ error: 'githubUsername is required' }, { status: 400 });
  }

  const normalized = githubUsername.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,39}$/i.test(normalized)) {
    return NextResponse.json({ error: 'Invalid GitHub username format' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { githubUsername: normalized } });
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      githubUsername: normalized,
      isAdmin: makeAdmin === true,
    },
  });

  return NextResponse.json({
    id: user.id,
    githubUsername: user.githubUsername,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
    groups: [],
  }, { status: 201 });
}
