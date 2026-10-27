import { listForConsole } from "@/server/console";
import { handler } from "@/server/http";
import { requireApi } from "@/server/session";

export const GET = handler(async () => {
  await requireApi("analyst");
  return Response.json(await listForConsole());
});
