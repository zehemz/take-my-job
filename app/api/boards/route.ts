import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapBoardSummary } from '@/lib/api-mappers';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const boards = await prisma.board.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(boards.map(mapBoardSummary));
}
