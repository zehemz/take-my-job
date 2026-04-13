import { broadcaster } from '@/lib/broadcaster-singleton';
import type { BroadcastEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { cardId: string } },
) {
  const { cardId } = params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: BroadcastEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client disconnected
        }
      };

      // Send a heartbeat comment immediately so the client knows it's connected
      controller.enqueue(encoder.encode(': connected\n\n'));

      const unsubscribe = broadcaster.subscribe(cardId, send);

      req.signal.addEventListener('abort', () => {
        unsubscribe();
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
