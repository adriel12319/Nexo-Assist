import { ConsoleView } from "@/components/console/console-view";
import { listForConsole } from "@/server/console";
import { requirePage } from "@/server/session";

export const metadata = { title: "Console do analista · Nexo Assist" };

export default async function ConsolePage() {
  const analyst = await requirePage("analyst");
  return <ConsoleView analyst={analyst} initial={await listForConsole()} />;
}
