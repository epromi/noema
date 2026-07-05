import { addClient } from "$lib/server/sse";
import { getCache } from "$lib/server/cache";
import type { DashboardData } from "$lib/types";
import type { RequestHandler } from "./$types";

const PING_MS = 30_000;

function formatEvent(data: DashboardData): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export const GET: RequestHandler = async ({ request }) => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: DashboardData) => {
        controller.enqueue(encoder.encode(formatEvent(data)));
      };

      controller.enqueue(encoder.encode(": connected\n\n"));

      const cached = getCache();
      if (cached) {
        send(cached);
      }

      const unsubscribe = addClient(send);

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, PING_MS);

      const cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
