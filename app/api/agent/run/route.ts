import { type NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db-queries';
import { anthropicClient } from '@/lib/anthropic-client';
import { broadcaster } from '@/lib/singleton';
import { run } from '@/lib/agent-runner';

export const dynamic = 'force-dynamic';

// Vercel Pro allows up to 300s; Enterprise up to 900s.
// Agent sessions can be long — set this as high as your plan allows.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { cardId, runId } = await req.json() as { cardId: string; runId: string };

  const [card, agentRun] = await Promise.all([
    dbQueries.getCard(cardId),
    dbQueries.getAgentRun(runId),
  ]);

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  if (!agentRun) return NextResponse.json({ error: 'AgentRun not found' }, { status: 404 });

  await run(card, agentRun, { db: dbQueries, anthropicClient, broadcaster });

  return NextResponse.json({ ok: true });
}
