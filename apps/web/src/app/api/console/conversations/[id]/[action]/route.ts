import { z } from "zod";
import { assume, close, releaseToAgent, sendAnalystMessage } from "@/server/console";
import { handler } from "@/server/http";
import { HttpError, requireApi } from "@/server/session";

const messageSchema = z.object({ text: z.string().trim().min(1).max(2000) });

export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
    const analyst = await requireApi("analyst");
    const { id, action } = await params;

    switch (action) {
      case "assume":
        await assume(analyst, id);
        break;
      case "release":
        await releaseToAgent(analyst, id);
        break;
      case "close":
        await close(analyst, id);
        break;
      case "messages":
        await sendAnalystMessage(analyst, id, messageSchema.parse(await request.json()).text);
        break;
      default:
        throw new HttpError(404, "Ação desconhecida.");
    }
    return Response.json({ ok: true });
  },
);
