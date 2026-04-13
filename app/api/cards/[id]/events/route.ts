import { type NextRequest } from 'next/server';
import { dbQueries } from '@/lib/db-queries';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const cardId = params.id;

  // Support resuming from a specific cursor via the standard SSE Last-Event-ID
  // header. EventSource sends this automatically on reconnect.
  const lastEventId = req.headers.get('last-event-id');
  let cursor = lastEventId ? parseInt(lastEventId, 10) : 0;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const enqueue = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      let done = false;

      const cleanup = () => {
        done = true;
        clearInterval(keepalive);
        try { controller.close(); } catch { /* already closed */ }
      };

      req.signal.addEventListener('abort', cleanup);

      const keepalive = setInterval(() => {
        if (!done) enqueue(': keepalive\n\n');
      }, 15_000);

      try {
        while (!done) {
          const rows = await dbQueries.getRunEventsSince(cardId, cursor);

          for (const { id, event } of rows) {
            if (done) break;
            cursor = id;
            enqueue(`id: ${id}\ndata: ${JSON.stringify(event)}\n\n`);
            if (event.type === 'done') {
              done = true;
              break;
            }
          }

          if (!done) {
            await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
          }
        }
      } finally {
        cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
