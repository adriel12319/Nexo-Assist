"use client";

import { type Draft, IMPACT_LABEL, type Ticket, type TicketSummary } from "@nexo/shared";
import { useState } from "react";
import { Dot, PriorityLabel, StatusLabel } from "@/components/ticket-bits";
import { formatDay, formatDayTime, formatRelativeDays, formatTime } from "@/lib/format";

const cardShell = "w-full overflow-hidden rounded-2xl bg-white shadow-card outline outline-ink/[0.09] -outline-offset-[0.5px]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[12.5px] text-muted">{label}</span>
      <div className="flex items-center gap-1.5 text-[14.5px] font-medium">{children}</div>
    </div>
  );
}

function Eyebrow({ kind, reference, children }: { kind: string; reference: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-0.5 text-[12.5px] text-muted">
      <span className="font-medium">{kind}</span>
      <span className="size-[3px] rounded-full bg-line" />
      <span>{reference}</span>
      <span className="flex-1" />
      {children}
    </div>
  );
}

export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <article className={cardShell}>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <Eyebrow kind="Chamado" reference={ticket.id}>
          <StatusLabel status={ticket.status} strong />
        </Eyebrow>
        <h3 className="text-lg leading-[23px] font-semibold tracking-[-0.2px]">{ticket.title}</h3>
        <p className="text-[13.5px] leading-5 text-body">{ticket.description}</p>
      </div>
      <div className="px-[18px] pb-4">
        <div className="flex flex-wrap gap-6 border-t border-line pt-3">
          <Field label="Categoria">{ticket.category}</Field>
          <Field label="Prioridade">
            <PriorityLabel priority={ticket.priority} />
          </Field>
          <Field label="Aberto em">{formatDayTime(ticket.createdAt)}</Field>
          <Field label="Última atualização">
            <span className={ticket.overdue ? "text-warning-text" : ""}>{formatRelativeDays(ticket.updatedAt)}</span>
            {ticket.overdue && <span className="text-[13.5px] font-normal text-muted">· prazo vencido</span>}
          </Field>
        </div>
      </div>
    </article>
  );
}

const DRAFT_STATE = {
  pending: { label: "Aguardando confirmação", dot: "bg-warning", text: "text-warning-text" },
  confirmed: { label: "Confirmado", dot: "bg-success", text: "text-success-text" },
  cancelled: { label: "Descartado", dot: "bg-ink/25", text: "text-muted" },
  failed: { label: "Falhou", dot: "bg-danger", text: "text-danger-text" },
} as const;

interface DraftCardProps {
  draft: Draft;
  interactive: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => Promise<void>;
  onEdit: () => void;
}

export function DraftCard({ draft, interactive, onConfirm, onCancel, onEdit }: DraftCardProps) {
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = DRAFT_STATE[draft.status];
  const { payload } = draft;

  const run = (action: "confirm" | "cancel", fn: () => Promise<void>) => async () => {
    setBusy(action);
    setError(null);
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    } finally {
      setBusy(null);
    }
  };

  const kindLabel = { create: "Novo chamado", update: "Atualização", reopen: "Reabertura" }[payload.kind];
  const title = payload.kind === "create" ? payload.ticket.title : `${payload.ticketId} · ${payload.ticketTitle}`;
  const description = payload.kind === "create" ? payload.ticket.description : payload.message;
  const pending = draft.status === "pending" && interactive;
  const priority = payload.kind === "create" ? payload.ticket.priority : payload.priority;
  const impact = payload.kind === "create" ? payload.ticket.impact : payload.impact;
  const { priorityReason } = payload;

  return (
    <article className={cardShell}>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <Eyebrow kind={kindLabel} reference={`Rascunho ${draft.id}`}>
          <span className={`flex items-center gap-1.5 font-medium ${state.text}`}>
            <Dot className={state.dot} />
            {draft.status === "confirmed" && draft.ticketId ? `${state.label} · ${draft.ticketId}` : state.label}
          </span>
        </Eyebrow>
        <h3 className="text-lg leading-[23px] font-semibold tracking-[-0.2px]">{title}</h3>
        <p className="text-[13.5px] leading-5 whitespace-pre-line text-body">{description}</p>
      </div>

      {(payload.kind === "create" || priority) && (
        <div className="px-[18px] pb-4">
          <div className="flex flex-wrap gap-6 border-t border-line pt-3">
            {payload.kind === "create" && <Field label="Categoria">{payload.ticket.category}</Field>}
            {priority && (
              <Field label="Prioridade">
                <PriorityLabel priority={priority} />
                {draft.dueAt && (
                  <span className="text-[13.5px] font-normal whitespace-nowrap text-muted">
                    · resposta até {sameDay(draft.dueAt) ? formatTime(draft.dueAt) : `${formatDay(draft.dueAt)}, ${formatTime(draft.dueAt)}`}
                  </span>
                )}
              </Field>
            )}
            {impact && <Field label="Afetados">{IMPACT_LABEL[impact]}</Field>}
          </div>
          {priorityReason && <p className="mt-2 text-[12.5px] text-muted">Por que essa prioridade: {priorityReason}</p>}
        </div>
      )}

      {pending && (
        <div className="flex items-center gap-1.5 border-t border-line bg-subtle py-2 pr-3.5 pl-2">
          <button
            onClick={run("confirm", onConfirm)}
            disabled={busy !== null}
            className="flex h-9 items-center rounded-lg bg-primary px-3.5 text-[13.5px] font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
          >
            {busy === "confirm" ? "Confirmando…" : "Confirmar"}
          </button>
          <button
            onClick={onEdit}
            disabled={busy !== null}
            className="flex h-9 items-center rounded-lg bg-white px-3.5 text-[13.5px] font-medium shadow-control hairline hover:bg-subtle"
          >
            Editar
          </button>
          <button
            onClick={run("cancel", onCancel)}
            disabled={busy !== null}
            className="flex h-9 items-center rounded-lg px-3.5 text-[13.5px] font-medium text-body hover:bg-white"
          >
            Cancelar
          </button>
          {error && <span className="ml-2 text-[12.5px] text-danger-text">{error}</span>}
        </div>
      )}
    </article>
  );
}

const sameDay = (iso: string) => formatDay(iso) === formatDay(new Date().toISOString());

export function TicketPicker({
  tickets,
  interactive,
  onPick,
}: {
  tickets: TicketSummary[];
  interactive: boolean;
  onPick: (ticket: TicketSummary) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div role="radiogroup" className={cardShell}>
      {tickets.map((ticket, index) => (
        <button
          key={ticket.id}
          role="radio"
          aria-checked={selected === ticket.id}
          disabled={!interactive}
          onClick={() => {
            setSelected(ticket.id);
            onPick(ticket);
          }}
          className={`flex h-[46px] w-full items-center gap-3.5 px-4 text-left enabled:hover:bg-primary/[0.04] ${
            index > 0 ? "border-t border-line" : ""
          } ${selected === ticket.id ? "bg-primary/[0.04]" : ""}`}
        >
          <span
            className={`size-4 shrink-0 rounded-full bg-white ${
              selected === ticket.id ? "border-[5px] border-primary" : "border-[1.5px] border-ink/20"
            }`}
          />
          <span className="text-[12.5px] font-medium text-muted">{ticket.id}</span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{ticket.title}</span>
          <StatusLabel status={ticket.status} />
          <span className="w-11 text-right text-[12.5px] text-muted">{formatDay(ticket.updatedAt)}</span>
        </button>
      ))}
    </div>
  );
}

export function QuickOptions({
  options,
  interactive,
  onPick,
}: {
  options: string[];
  interactive: boolean;
  onPick: (option: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          disabled={!interactive}
          onClick={() => onPick(option)}
          className="rounded-lg bg-white px-3 py-[7px] text-[13.5px] font-medium hairline-soft enabled:hover:bg-accent-soft enabled:hover:text-primary-text enabled:hover:outline-accent disabled:text-muted"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
