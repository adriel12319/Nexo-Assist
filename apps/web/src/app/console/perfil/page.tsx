import { ConsoleRail } from "@/components/console/console-rail";
import { AccountDetails } from "@/components/profile";
import { requirePage } from "@/server/session";

export const metadata = { title: "Meu perfil · Nexo Assist" };

export default async function AnalystProfilePage() {
  const analyst = await requirePage("analyst");

  return (
    <div className="flex h-screen bg-white">
      <ConsoleRail analyst={analyst} active="profile" />
      <main className="flex-1 overflow-y-auto px-6 py-12">
        <div className="mx-auto flex max-w-[600px] flex-col gap-8">
          <AccountDetails user={analyst} />
        </div>
      </main>
    </div>
  );
}
