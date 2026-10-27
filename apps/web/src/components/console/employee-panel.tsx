import { PRIORITY_LABEL, STATUS_LABEL, TRANSFER_REASON_LABEL, isOpenStatus } from "@nexo/shared";
import { ArrowRightLeft } from "lucide-react";
import { StatusLabel, statusDotClass } from "@/components/ticket-bits";
import type { ConversationDetail } from "@/lib/console-types";
import { formatDay, formatTime } from "@/lib/format";

export function EmployeePanel({ detail }: { detail: ConversationDetail }) {
  const { employee, tickets, conversation } = detail;
  const firstName = employee.name.split(" ")[0];
  const transfer = conversation.transfer;
  const current = tickets?.find((ticket) => ticket.id === transfer?.ticketId);
  const others = tickets?.filter((ticket) => ticket.id !== current?.id) ?? [];
  const openCount = tickets?.filter((ticket) => isOpenStatus(ticket.status)).length ?? 0;

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col border-l border-line bg-white xl:flex">
      <header className="flex h-16 shrink-0 flex-col justify-center border-b border-line px-5">
        <p className="text-[15.5px] font-semibold">Chamados de {firstName}</p>
        <p className="text-[12.5px] text-muted">
          {tickets ? `${openCount} abertos · ${tickets.length - openCount} encerrados` : "Sistema de chamados indisponível"}
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-5 pt-6 pb-5">
        {transfer && (
          <section className="flex flex-col gap-3">
            <h3 className="text-[12.5px] font-semibold text-muted">Resumo da transferência</h3>
            <div className="flex flex-col gap-2 rounded-xl bg-warning-soft p-4">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-warning-text">
                <ArrowRightLeft className="size-3.5" />
                {TRANSFER_REASON_LABEL[transfer.reason]} · {formatTime(transfer.at)}
              </p>
              <p className="text-[13.5px] leading-5 text-body">{transfer.summary}</p>
              {transfer.confidence !== null && (
                <p className="text-[12.5px] text-muted">Confiança do agent: {Math.round(transfer.confidence * 100)}%</p>
              )}
            </div>
          </section>
        )}

        {current && (
          <section className="flex flex-col gap-3">
            <h3 className="text-[12.5px] font-semibold text-muted">Desta conversa</h3>
            <div className="flex flex-col gap-1.5 rounded-xl bg-subtle p-4">
              <p className="flex items-center text-[12.5px] font-medium text-muted">
                <span className="flex-1">{current.id}</span>
                <StatusLabel status={current.status} strong />
              </p>
              <p className="text-[15.5px] leading-5 font-semibold">{current.title}</p>
              <p className="text-[13.5px] text-muted">
                {current.category} · prioridade {PRIORITY_LABEL[current.priority].toLowerCase()}
                {current.overdue && <span className="text-warning-text"> · prazo vencido</span>}
              </p>
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="flex flex-col gap-1">
            <h3 className="text-[12.5px] font-semibold text-muted">{current ? "Outros chamados" : "Chamados"}</h3>
            {others.map((ticket) => (
              <div key={ticket.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <span className={`size-[7px] shrink-0 rounded-full ${statusDotClass(ticket.status)}`} />
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-medium">{ticket.title}</p>
                  <p className="text-[12.5px] text-muted">
                    {ticket.id} ·{" "}
                    {isOpenStatus(ticket.status)
                      ? STATUS_LABEL[ticket.status]
                      : `${STATUS_LABEL[ticket.status]} em ${formatDay(ticket.resolvedAt ?? ticket.updatedAt)}`}
                    {ticket.overdue && <span className="text-warning-text"> · vencido</span>}
                  </p>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}
