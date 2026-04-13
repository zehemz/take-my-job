import { type NextRequest } from 'next/server';
import { dbQueries } from '@/lib/db-queries';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const boardId = params.id;

  const lastEventId = req.headers.get('last-event-id');
  let cursor = lastEventId ? parseInt(lastEventId, 10) : 0;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      let closed = false;

      const cleanup = () => {
        closed = true;
        clearInterval(keepalive);
        try { controller.close(); } catch { /* already closed */ }
      };

      req.signal.addEventListener('abort', cleanup);

      const keepalive = setInterval(() => {
        if (!closed) enqueue(': keepalive\n\n');
      }, 15_000);

      try {
        while (!closed) {
          const rows = await dbQueries.getBoardEventsSince(boardId, cursor);

          for (const { id, event } of rows) {
            if (closed) break;
            cursor = id;
            enqueue(`id: ${id}\ndata: ${JSON.stringify(event)}\n\n`);
          }

          if (!closed) {
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
