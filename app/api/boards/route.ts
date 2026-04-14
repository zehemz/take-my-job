import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapBoardSummary } from '@/lib/api-mappers';
import type { CreateBoardRequest } from '@/lib/api-types';
import { devAuth as auth } from '@/lib/dev-auth';

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

  const board = await prisma.board.create({
    data: {
      name,
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

  return NextResponse.json(mapBoardSummary(board), { status: 201 });
}
