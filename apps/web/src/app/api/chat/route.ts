import { z } from "zod";
import { type ChatEvent, handleUserMessage } from "@/server/chat";
import { errorResponse, handler, rateLimit } from "@/server/http";
import { requireApi } from "@/server/session";

export const maxDuration = 60;

const bodySchema = z.object({ text: z.string().trim().min(1).max(2000) });

export const POST = handler(async (request: Request) => {
  const user = await requireApi("employee");
  rateLimit(`chat:${user.id}`, 12);
  const { text } = bodySchema.parse(await request.json());

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await handleUserMessage(user, text, send);
      } catch (error) {
        const response = errorResponse(error);
        const { error: message } = (await response.json()) as { error: string };
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform" },
  });
});
