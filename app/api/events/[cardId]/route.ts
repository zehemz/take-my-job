import { NextResponse } from 'next/server';
import { dbQueries } from '@/lib/db-queries';
import type { OrchestratorEvent } from '@/lib/types';
import type { BroadcastEvent } from '@/lib/types';
import { devAuth as auth } from '@/lib/dev-auth';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 500;

function mapEventToBroadcast(event: OrchestratorEvent): BroadcastEvent | null {
  const p = event.payload as Record<string, unknown>;

  switch (event.type) {
    case "agent_message":
      return { type: "agent_message", text: (p.text as string) ?? "" };
    case "agent_thinking":
      return { type: "agent_thinking", thinking: (p.thinking as string) ?? "" };
    case "tool_use":
      return { type: "tool_use", tool_name: (p.tool_name as string) ?? "", input: p.input };
    case "card_update":
      return {
        type: "card_update",
        status: p.status as string,
        summary: (p.summary as string) ?? "",
        next_column: p.next_column as string | undefined,
        criteria_results: p.criteria_results as BroadcastEvent extends { type: "card_update"; criteria_results?: infer T } ? T : never,
      };
    case "card_blocked":
      return {
        type: "card_blocked",
        reason: (p.reason as string) ?? "",
        session_id: (p.session_id as string) ?? "",
        cli_command: (p.cli_command as string) ?? "",
      };
    case "status_change":
      return { type: "status_change", status: p.status as BroadcastEvent extends { type: "status_change"; status: infer S } ? S : never };
    case "error":
      return { type: "error", message: (p.message as string) ?? "" };
    default:
      return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: { cardId: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = params;
  const encoder = new TextEncoder();

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since');
  let cursor = sinceParam ? new Date(sinceParam) : new Date();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));

      let stopped = false;

      const poll = async () => {
        if (stopped) return;
        try {
          const events = await dbQueries.getCardEventsSince(cardId, cursor);
          for (const event of events) {
            const broadcast = mapEventToBroadcast(event);
            if (broadcast) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(broadcast)}\n\n`));
            }
            if (event.createdAt > cursor) {
              cursor = event.createdAt;
            }
          }
        } catch {
          // DB error — skip this tick, retry next
        }
        if (!stopped) {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      };

      setTimeout(poll, POLL_INTERVAL_MS);

      req.signal.addEventListener('abort', () => {
        stopped = true;
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
