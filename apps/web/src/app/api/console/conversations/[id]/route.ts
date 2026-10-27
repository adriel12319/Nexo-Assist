import { getConsoleConversation } from "@/server/console";
import { handler } from "@/server/http";
import { requireApi } from "@/server/session";

export const GET = handler(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireApi("analyst");
  return Response.json(await getConsoleConversation((await params).id));
});
