import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapBoardSummary } from '@/lib/api-mappers';
import type { CreateBoardRequest } from '@/lib/api-types';
import { devAuth as auth } from '@/lib/dev-auth';
import { config } from '@/lib/config';
import { slugify, ensureBoardFolder } from '@/lib/workspace';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const boards = await prisma.board.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { columns: true, cards: true } } },
  });
  return NextResponse.json(boards.map(mapBoardSummary));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: CreateBoardRequest = await req.json();
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  // Resolve workspace path: user-provided or auto-generated slug
  let workspacePath: string | undefined;
  if (config.WORKSPACE_REPO_URL) {
    workspacePath = body.workspacePath?.trim() || undefined;

    // Validate: provision the folder BEFORE creating the board so we can return an error
    if (workspacePath) {
      try {
        await ensureBoardFolder(name, workspacePath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 409 });
      }
    }
  }

  const environmentId = body.environmentId?.trim() || undefined;

  const board = await prisma.board.create({
    data: {
      name,
      ...(environmentId ? { anthropicEnvironmentId: environmentId } : {}),
      ...(workspacePath ? { githubRepo: config.WORKSPACE_REPO_URL, workspacePath } : {}),
      columns: {
        create: [
          { name: 'Backlog',     position: 0, columnType: 'inactive', isActiveState: false, isTerminalState: false },
          { name: 'In Progress', position: 1, columnType: 'active',   isActiveState: true,  isTerminalState: false },
          { name: 'Blocked',     position: 2, columnType: 'blocked',  isActiveState: false, isTerminalState: false },
          { name: 'Review',      position: 3, columnType: 'review',   isActiveState: true,  isTerminalState: false },
          { name: 'Revision',    position: 4, columnType: 'revision', isActiveState: true,  isTerminalState: false },
          { name: 'Done',        position: 5, columnType: 'terminal', isActiveState: false, isTerminalState: true  },
        ],
      },
    },
    include: { _count: { select: { columns: true, cards: true } } },
  });

  // If no explicit path was provided, auto-generate one
  if (config.WORKSPACE_REPO_URL && !workspacePath) {
    workspacePath = `boards/${slugify(name, board.id)}`;
    try {
      await ensureBoardFolder(name, workspacePath);
      await prisma.board.update({
        where: { id: board.id },
        data: { githubRepo: config.WORKSPACE_REPO_URL, workspacePath },
      });
      const updated = await prisma.board.findUnique({
        where: { id: board.id },
        include: { _count: { select: { columns: true, cards: true } } },
      });
      if (updated) return NextResponse.json(mapBoardSummary(updated), { status: 201 });
    } catch (err) {
      console.warn('Failed to provision workspace folder:', err);
    }
  }

  return NextResponse.json(mapBoardSummary(board), { status: 201 });
}
