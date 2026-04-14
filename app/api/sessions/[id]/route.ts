import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { devAuth as auth } from '@/lib/dev-auth';
import { anthropicClient } from '@/lib/anthropic-client';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: sessionId } = params;

  try {
    // Interrupt the Anthropic session
    await anthropicClient.interruptSession(sessionId);
  } catch (err) {
    // Session may already be terminated — that's fine
    console.warn('[sessions/stop] interrupt failed (may already be terminated):', err);
  }

  // Cancel any agent runs linked to this session
  await prisma.agentRun.updateMany({
    where: {
      sessionId,
      status: { in: ['running', 'idle', 'pending'] },
    },
    data: { status: 'cancelled' },
  });

  return NextResponse.json({ ok: true });
}
