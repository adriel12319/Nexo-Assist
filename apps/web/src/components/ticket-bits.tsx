import { PRIORITY_LABEL, type Priority, STATUS_LABEL, type TicketStatus } from "@nexo/shared";

const STATUS_DOT: Record<TicketStatus, string> = {
  aberto: "bg-accent",
  em_andamento: "bg-accent",
  aguardando_analista: "bg-warning",
  aprovado: "bg-success",
  resolvido: "bg-ink/25",
  fechado: "bg-ink/25",
};

const PRIORITY_DOT: Record<Priority, string> = {
  critica: "bg-danger",
  alta: "bg-warning",
  media: "bg-ink/40",
  baixa: "bg-ink/20",
};

export function Dot({ className }: { className: string }) {
  return <span className={`size-1.5 shrink-0 rounded-full ${className}`} />;
}

export function StatusLabel({ status, strong = false }: { status: TicketStatus; strong?: boolean }) {
  const emphasis = strong && status === "aguardando_analista" ? "font-medium text-warning-text" : "text-muted";
  return (
    <span className={`flex items-center gap-1.5 text-[12.5px] whitespace-nowrap ${emphasis}`}>
      <Dot className={STATUS_DOT[status]} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className="flex items-center gap-1.5 text-[14.5px] font-medium">
      <Dot className={PRIORITY_DOT[priority]} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export const statusDotClass = (status: TicketStatus) => STATUS_DOT[status];
