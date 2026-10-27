"use client";

import type { Card, ChatMessage, Person } from "@nexo/shared";
import { ArrowUp, Bot, CircleStop, Hand, Headset, Undo2, UserRoundCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ConversationDetail } from "@/lib/console-types";
import { formatTime } from "@/lib/format";
import { AgentTrace } from "@/components/chat/agent-trace";
import { Avatar } from "./avatar";

type Action = "assume" | "release" | "close";

export function ConversationPane({
  detail,
  analyst,
  onChange,
}: {
  detail: ConversationDetail;
  analyst: Person;
  onChange: () => Promise<void>;
}) {
  const { conversation, employee, messages, assignedAnalyst } = detail;
  const [busy, setBusy] = useState<Action | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const mine = conversation.status === "with_analyst" && conversation.assignedAnalystId === analyst.id;
  const firstName = employee.name.split(" ")[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function perform(action: Action | "send", request: () => Promise<unknown>) {
    setBusy(action);
    setError(null);
    try {
      await request();
      await onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    } finally {
      setBusy(null);
    }
  }

  const act = (action: Action) => () =>
    perform(action, () => api(`/api/console/conversations/${conversation.id}/${action}`, { method: "POST" }));

  const send = () =>
    perform("send", async () => {
      await api(`/api/console/conversations/${conversation.id}/messages`, { method: "POST", json: { text } });
      setText("");
    });

  const meta = [employee.department, conversation.transfer?.ticketId].filter(Boolean).join(" · ");

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white pr-4 pl-5">
        <Avatar id={employee.id} name={employee.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-semibold">{employee.name}</p>
          <p className="truncate text-[12.5px] text-muted">{meta}</p>
        </div>
        {mine ? (
          <>
            <button onClick={act("release")} disabled={busy !== null} className="flex h-9 items-center gap-1.5 rounded-lg pr-3 pl-2.5 text-[13.5px] font-medium text-body hairline hover:bg-subtle">
              <Undo2 className="size-4" /> Devolver ao agent
            </button>
            <button onClick={act("close")} disabled={busy !== null} className="flex h-9 items-center gap-1.5 rounded-lg bg-danger-soft pr-3 pl-2.5 text-[13.5px] font-semibold text-danger-text hover:bg-danger/15">
              <CircleStop className="size-4" /> Encerrar atendimento
            </button>
          </>
        ) : (
          <ModePill status={conversation.status} analystName={assignedAnalyst?.name} />
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-10 pt-5 pb-4">
        <div className="flex min-h-full flex-col justify-end">
          {messages.map((message, index) => (
            <Message key={message.id} message={message} grouped={messages[index - 1]?.role === message.role} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <footer className="flex flex-col gap-2.5 border-t border-line bg-white px-5 pt-3 pb-3.5">
        {error && <p className="text-[12.5px] text-danger-text">{error}</p>}

        {mine && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (text.trim()) void send();
            }}
            className="flex items-center gap-3"
          >
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Responder ${firstName}…`}
              className="h-11 flex-1 rounded-xl bg-subtle px-3.5 text-[14.5px] outline-none focus:outline-1 focus:outline-accent"
              autoFocus
            />
            <button disabled={!text.trim() || busy !== null} aria-label="Enviar" className="grid size-11 place-items-center rounded-full bg-primary text-white disabled:opacity-50">
              <ArrowUp className="size-5" />
            </button>
          </form>
        )}

        {!mine && conversation.status !== "closed" && (
          <>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-warning-soft text-warning-text">
                {conversation.status === "agent" ? <Bot className="size-[18px]" /> : <Hand className="size-[18px]" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold">
                  {conversation.status === "waiting_analyst" && `${firstName} espera um atendente`}
                  {conversation.status === "agent" && "O agent está atendendo"}
                  {conversation.status === "with_analyst" && `${assignedAnalyst?.name ?? "Outro analista"} está atendendo`}
                </p>
                <p className="text-[12.5px] text-muted">
                  {conversation.status === "waiting_analyst" && `Agent pausado desde ${formatTime(conversation.transfer?.at ?? new Date().toISOString())}`}
                  {conversation.status === "agent" && "Você pode assumir se precisar intervir"}
                  {conversation.status === "with_analyst" && "Somente quem assumiu pode responder"}
                </p>
              </div>
              {conversation.status === "waiting_analyst" && (
                <button onClick={act("release")} disabled={busy !== null} className="flex h-9 items-center gap-[7px] rounded-lg pr-3.5 pl-3 text-[13.5px] font-medium text-body hairline hover:bg-subtle">
                  <Undo2 className="size-4" /> Devolver ao agent
                </button>
              )}
              {conversation.status !== "with_analyst" && (
                <button onClick={act("assume")} disabled={busy !== null} className="flex h-9 items-center gap-[7px] rounded-lg bg-primary pr-4 pl-3.5 text-[13.5px] font-semibold text-white hover:bg-primary/90 disabled:opacity-70">
                  <UserRoundCheck className="size-4" /> {busy === "assume" ? "Assumindo…" : "Assumir atendimento"}
                </button>
              )}
            </div>
            <p className="flex h-11 items-center rounded-xl bg-subtle px-3.5 text-[14.5px] text-muted opacity-55">
              Assuma o atendimento para responder
            </p>
          </>
        )}

        {conversation.status === "closed" && <p className="py-2 text-center text-[13.5px] text-muted">Atendimento encerrado.</p>}
      </footer>
    </section>
  );
}

function ModePill({ status, analystName }: { status: ConversationDetail["conversation"]["status"]; analystName?: string }) {
  const config = {
    waiting_analyst: ["Aguardando atendente", "bg-warning-soft text-warning-text"],
    agent: ["Com o agent", "bg-success-soft text-success-text"],
    with_analyst: [`Com ${analystName ?? "analista"}`, "bg-accent-soft text-primary-text"],
    closed: ["Encerrada", "bg-subtle text-muted"],
  }[status];
  return (
    <span className={`flex items-center gap-[7px] rounded-full px-[11px] py-1.5 text-[12.5px] font-semibold ${config[1]}`}>
      <Headset className="size-3.5" /> {config[0]}
    </span>
  );
}

const describeCard = (card: Card) => {
  switch (card.kind) {
    case "ticket":
      return `Mostrou o chamado ${card.ticket.id}`;
    case "ticket-picker":
      return `Pediu para escolher entre ${card.tickets.length} chamados`;
    case "draft":
      return `Rascunho ${card.draftId}`;
    case "options":
      return `Opções: ${card.options.join(" · ")}`;
  }
};

function Message({ message, grouped }: { message: ChatMessage; grouped: boolean }) {
  if (message.role === "system") {
    return (
      <div className="flex items-center gap-3 pt-[18px] pb-1 text-[12px] font-medium text-muted">
        <span className="h-px flex-1 bg-ink/[0.08]" />
        <span className="flex items-center gap-1.5">
          <Headset className="size-3.5" /> {message.content}
        </span>
        <span className="h-px flex-1 bg-ink/[0.08]" />
      </div>
    );
  }

  const fromEmployee = message.role === "user";
  const isAgent = message.role === "agent";

  return (
    <div className={`flex flex-col gap-1 ${grouped ? "pt-[3px]" : "pt-4"} ${fromEmployee ? "items-start" : "items-end"}`}>
      {!fromEmployee && !grouped && (
        <p className="flex items-center gap-1.5 px-1 text-[12px] font-semibold text-body">
          {message.authorName}
          <span className={`rounded-md px-1.5 py-px text-[11px] ${isAgent ? "bg-accent-soft text-primary-text" : "bg-success-soft text-success-text"}`}>
            {isAgent ? "IA" : "Analista"}
          </span>
        </p>
      )}
      <div
        className={`flex max-w-[480px] flex-col gap-1 px-3 pt-2 pb-1.5 shadow-[0_1px_2px_#1B243112] ${
          fromEmployee ? "rounded-[4px_12px_12px_12px] bg-white" : `rounded-[12px_4px_12px_12px] ${isAgent ? "bg-bubble-agent" : "bg-bubble-human"}`
        }`}
      >
        {message.content && <p className="text-[14.5px] leading-[21px] whitespace-pre-line">{message.content}</p>}
        {message.cards.map((card, index) => (
          <p key={index} className="rounded-md bg-white/70 px-2 py-1 text-[12.5px] text-body">
            {describeCard(card)}
          </p>
        ))}
        {isAgent && message.trace && (message.trace.steps.length > 0 || message.trace.decision) && (
          <div className="text-[11.5px]">
            <AgentTrace trace={message.trace} showName={false} />
          </div>
        )}
        <span className="self-end text-[11px] text-muted">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
