import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const configs = await prisma.agentConfig.findMany({
    select: { role: true },
    orderBy: { role: 'asc' },
  });
  const roles = configs.map((c) => c.role);
  return NextResponse.json({ roles });
}
