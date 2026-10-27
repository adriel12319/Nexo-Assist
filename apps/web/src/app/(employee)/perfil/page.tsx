import { STATUS_LABEL, isOpenStatus } from "@nexo/shared";
import { AccountDetails, profileCard } from "@/components/profile";
import { statusDotClass } from "@/components/ticket-bits";
import { TopBar } from "@/components/top-bar";
import { formatDay } from "@/lib/format";
import { requirePage } from "@/server/session";
import { tickets } from "@/server/tickets";

export const metadata = { title: "Meu perfil · Nexo Assist" };

export default async function PerfilPage() {
  const user = await requirePage("employee");
  const myTickets = await tickets.list(user.id).catch(() => null);

  return (
    <>
      <TopBar here="Meu perfil" />
      <div className="flex-1 overflow-y-auto px-6 py-12">
        <div className="mx-auto flex max-w-[600px] flex-col gap-8">
          <AccountDetails user={user} />

          <section className="flex flex-col gap-3">
            <h2 className="text-[15.5px] font-semibold">Meus chamados</h2>
            {myTickets === null ? (
              <p className="text-[13.5px] text-muted">O sistema de chamados está indisponível agora. Tente recarregar.</p>
            ) : (
              <div className={profileCard}>
                {myTickets.map((ticket, index) => (
                  <div key={ticket.id} className={`flex items-center gap-3 px-5 py-3 ${index ? "border-t border-line" : ""}`}>
                    <span className={`size-[7px] rounded-full ${statusDotClass(ticket.status)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium">{ticket.title}</p>
                      <p className="text-[12.5px] text-muted">
                        {ticket.id} · {STATUS_LABEL[ticket.status]}
                        {isOpenStatus(ticket.status) && ticket.overdue && <span className="text-warning-text"> · prazo vencido</span>}
                      </p>
                    </div>
                    <span className="text-[12.5px] text-muted">{formatDay(ticket.updatedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
