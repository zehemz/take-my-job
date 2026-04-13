import { type NextRequest, NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db-queries';
import { anthropicClient } from '@/lib/anthropic-client';
import { AgentRunStatus } from '@/lib/types';
import { scheduleRetry } from '@/lib/orchestrator/retry';

export const dynamic = 'force-dynamic';

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_AGENTS ?? '5', 10);
const MAX_STALL_MS = parseInt(process.env.MAX_STALL_MS ?? '3600000', 10);

export async function GET(req: NextRequest) {
  // Vercel automatically sets CRON_SECRET and sends it as Authorization: Bearer <secret>.
  // Skip the check in local dev where the env var is absent.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [reconciled, dispatched] = await Promise.all([
    reconcile(),
    dispatch(req),
  ]);

  return NextResponse.json({ ok: true, reconciled, dispatched });
}

// ---------------------------------------------------------------------------
// Reconcile — check all running/idle sessions for terminal state or stalls
// ---------------------------------------------------------------------------

async function reconcile(): Promise<number> {
  const runningRuns = await dbQueries.getRunningRuns();
  let count = 0;

  await Promise.all(
    runningRuns.map(async (run) => {
      const card = await dbQueries.getCard(run.cardId);
      if (!card) {
        if (run.sessionId) await anthropicClient.interruptSession(run.sessionId).catch(() => {});
        await dbQueries.updateAgentRunStatus(run.id, AgentRunStatus.cancelled);
        count++;
        return;
      }

      if (card.column.isTerminalState || !card.column.isActiveState) {
        if (run.sessionId) await anthropicClient.interruptSession(run.sessionId).catch(() => {});
        await dbQueries.updateAgentRunStatus(run.id, AgentRunStatus.cancelled);
        count++;
        return;
      }

      if (run.sessionId) {
        const session = await anthropicClient.retrieveSession(run.sessionId);
        if (session.status === 'terminated') {
          if (session.outcome === 'success') {
            await dbQueries.updateAgentRunStatus(run.id, AgentRunStatus.completed);
          } else {
            await scheduleRetry(run, dbQueries);
          }
          count++;
          return;
        }
      }

      const stalledMs = Date.now() - run.updatedAt.getTime();
      if (stalledMs > MAX_STALL_MS) {
        if (run.sessionId) await anthropicClient.interruptSession(run.sessionId).catch(() => {});
        await scheduleRetry(run, dbQueries);
        count++;
      }
    }),
  );

  return count;
}

// ---------------------------------------------------------------------------
// Dispatch — find eligible cards and fire off agent runs
// ---------------------------------------------------------------------------

async function dispatch(req: NextRequest): Promise<number> {
  const runningRuns = await dbQueries.getRunningRuns();
  const available = MAX_CONCURRENT - runningRuns.length;
  if (available <= 0) return 0;

  // Base URL for internal fetch calls. On Vercel, VERCEL_URL is set automatically.
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : new URL(req.url).origin;

  const agentRunUrl = `${origin}/api/agent/run`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.CRON_SECRET) headers['authorization'] = `Bearer ${process.env.CRON_SECRET}`;

  let count = 0;

  // Fresh card dispatch
  const candidates = await dbQueries.getEligibleCards(available, []);
  for (const card of candidates) {
    const run = await dbQueries.createAgentRun(card.id, card.columnId, card.role ?? 'backend_engineer', 1);
    // Fire and forget — creates an independent Lambda invocation with its own maxDuration
    fetch(agentRunUrl, { method: 'POST', headers, body: JSON.stringify({ cardId: card.id, runId: run.id }) })
      .catch(() => {});
    count++;
  }

  // Retry-eligible runs
  const retryRuns = await dbQueries.getRetryEligibleRuns();
  for (const prevRun of retryRuns) {
    if (count >= available) break;
    const card = await dbQueries.getCard(prevRun.cardId);
    if (!card) continue;
    const run = await dbQueries.createAgentRun(card.id, card.columnId, prevRun.role, prevRun.attempt + 1);
    fetch(agentRunUrl, { method: 'POST', headers, body: JSON.stringify({ cardId: card.id, runId: run.id }) })
      .catch(() => {});
    count++;
  }

  return count;
}
