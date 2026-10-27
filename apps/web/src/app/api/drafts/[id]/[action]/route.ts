import { cancelDraft, confirmDraft } from "@/server/drafts";
import { handler } from "@/server/http";
import { HttpError, requireApi } from "@/server/session";

export const POST = handler(async (_request: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const user = await requireApi("employee");
  const { id, action } = await params;

  if (action === "confirm") return Response.json({ ticket: await confirmDraft(user, id) });
  if (action === "cancel") {
    await cancelDraft(user, id);
    return Response.json({ ok: true });
  }
  throw new HttpError(404, "Ação desconhecida.");
});
