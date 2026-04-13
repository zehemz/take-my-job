import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapBoardSummary } from '@/lib/api-mappers';

export async function GET() {
  const boards = await prisma.board.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(boards.map(mapBoardSummary));
}
