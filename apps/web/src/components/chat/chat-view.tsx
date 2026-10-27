"use client";

import { type Card, type ChatMessage, type ConversationStatus, type Draft, MESSAGE_LIMIT, type TraceStep } from "@nexo/shared";
import { ArrowUp, Headset } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusPill, TopBar } from "@/components/top-bar";
import { api, readEvents } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { AgentTrace } from "./agent-trace";
import { DraftCard, QuickOptions, TicketCard, TicketPicker } from "./cards";
import { RichText } from "./rich-text";

export interface ConversationSnapshot {
  status: ConversationStatus;
  messagesLeft: number;
  messages: ChatMessage[];
  drafts: Record<string, Draft>;
}

type ServerEvent =
  | { type: "step"; step: TraceStep }
  | { type: "text"; delta: string }
  | { type: "card"; card: Card }
  | { type: "draft"; draft: Draft }
  | { type: "error"; message: string }
  | { type: "done" };

interface LiveTurn {
  userText: string;
  steps: TraceStep[];
  text: string;
  cards: Card[];
}

const SUGGESTIONS = [
  "Minha VPN não conecta, aparece o erro 809",
  "Qual o status do meu chamado?",
  "Preciso instalar um software novo",
];

const POLL_MS = 4000;

export function ChatView({ initial }: { initial: ConversationSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [live, setLive] = useState<LiveTurn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setSnapshot(await api<ConversationSnapshot>("/api/conversation"));
  }, []);

  // Um analista pode assumir e responder a qualquer momento, então a conversa é sempre atualizada.
  useEffect(() => {
    if (live) return;
    const timer = setInterval(() => {
      if (!document.hidden) refresh().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [live, refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [snapshot.messages.length, live?.text, live?.steps.length, live?.cards.length]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || live) return;
    setError(null);
    setDraftText("");
    setLive({ userText: content, steps: [], text: "", cards: [] });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Não foi possível enviar a mensagem.");
      }
      await readEvents<ServerEvent>(response, (event) => {
        switch (event.type) {
          case "step":
            setLive((turn) => turn && { ...turn, steps: [...turn.steps, event.step] });
            break;
          case "text":
            setLive((turn) => turn && { ...turn, text: turn.text + event.delta });
            break;
          case "card":
            setLive((turn) => turn && { ...turn, cards: [...turn.cards, event.card] });
            break;
          case "draft":
            setSnapshot((current) => ({ ...current, drafts: { ...current.drafts, [event.draft.id]: event.draft } }));
            break;
          case "error":
            setError(event.message);
            break;
        }
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a mensagem.");
      setDraftText(content);
    } finally {
      setLive(null);
    }
  }

  async function draftAction(id: string, action: "confirm" | "cancel") {
    await api(`/api/drafts/${id}/${action}`, { method: "POST" });
    await refresh();
  }

  function editDraft() {
    setDraftText("Quero ajustar o rascunho: ");
    inputRef.current?.focus();
  }

  const { messages, drafts, status, messagesLeft } = snapshot;
  const lastAgentIndex = messages.findLastIndex((message) => message.role === "agent");
  const canInteract = status === "agent" && !live;
  const limitReached = messagesLeft <= 0;

  // Rascunhos não dependem da última mensagem: um pendente continua confirmável depois de outras perguntas.
  const draftsInteractive = status === "agent" && !live;

  const renderCards = (cards: Card[], interactive: boolean) =>
    cards
      .filter((card) => card.kind !== "options")
      .map((card, index) => {
        switch (card.kind) {
          case "ticket":
            return <TicketCard key={index} ticket={card.ticket} />;
          case "ticket-picker":
            return (
              <TicketPicker
                key={index}
                tickets={card.tickets}
                interactive={interactive}
                onPick={(ticket) => send(`${ticket.id} · ${ticket.title}`)}
              />
            );
          case "draft": {
            const draft = drafts[card.draftId];
            return draft ? (
              <DraftCard
                key={index}
                draft={draft}
                interactive={draftsInteractive}
                onConfirm={() => draftAction(draft.id, "confirm")}
                onCancel={() => draftAction(draft.id, "cancel")}
                onEdit={editDraft}
              />
            ) : null;
          }
        }
      });

  return (
    <>
      <TopBar here="Atendimento">
        {status === "agent" && <StatusPill tone="success">Assistente online</StatusPill>}
        {status === "waiting_analyst" && <StatusPill tone="warning">Aguardando analista</StatusPill>}
        {status === "with_analyst" && <StatusPill tone="info">Em atendimento com analista</StatusPill>}
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-[848px] flex-col justify-end gap-5 px-6 pt-7 pb-1">
            {messages.length === 0 && !live && <EmptyState onPick={send} />}

            {messages.map((message, index) => {
              const interactive = canInteract && index === lastAgentIndex && index === messages.length - 1;
              switch (message.role) {
                case "user":
                  return <UserBubble key={message.id} text={message.content} />;
                case "system":
                  return <SystemLine key={message.id} text={message.content} />;
                case "analyst":
                  return <AnalystMessage key={message.id} message={message} />;
                case "agent":
                  return (
                    <AgentBlock key={message.id} trace={<AgentTrace trace={message.trace} />} text={message.content} cards={message.cards} interactive={interactive} onOption={send}>
                      {renderCards(message.cards, interactive)}
                    </AgentBlock>
                  );
              }
            })}

            {live && (
              <>
                <UserBubble text={live.userText} />
                {status === "agent" && (
                  <AgentBlock trace={<AgentTrace trace={{ steps: live.steps }} running />} text={live.text} cards={live.cards} interactive={false} onOption={send}>
                    {renderCards(live.cards, false)}
                  </AgentBlock>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <footer className="mx-auto w-full max-w-[848px] px-6 pt-2.5 pb-[18px]">
          {error && (
            <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-[13.5px] text-danger-text">
              {error}
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draftText);
            }}
            className="flex min-h-12 items-end gap-2 rounded-xl bg-white py-1.5 pr-1.5 pl-4 hairline focus-within:outline-accent"
          >
            <textarea
              ref={inputRef}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draftText);
                }
              }}
              rows={1}
              maxLength={2000}
              disabled={limitReached}
              placeholder={
                limitReached
                  ? "Limite de mensagens atingido. Ligue no ramal 4000."
                  : status === "with_analyst"
                    ? "Escreva para o analista…"
                    : "Escreva para o Nexo…"
              }
              className="max-h-40 flex-1 resize-none self-center bg-transparent py-1.5 text-[14.5px] outline-none placeholder:text-muted [field-sizing:content]"
            />
            <button
              type="submit"
              disabled={!draftText.trim() || Boolean(live) || limitReached}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13.5px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <ArrowUp className="size-4" /> Enviar
            </button>
          </form>
          <p className="mt-1.5 text-right text-[12.5px] text-muted">
            {MESSAGE_LIMIT - messagesLeft}/{MESSAGE_LIMIT} mensagens nesta sessão
          </p>
        </footer>
      </div>
    </>
  );
}

function AgentBlock({
  trace,
  text,
  cards,
  interactive,
  onOption,
  children,
}: {
  trace: React.ReactNode;
  text: string;
  cards: Card[];
  interactive: boolean;
  onOption: (option: string) => void;
  children: React.ReactNode;
}) {
  const options = cards.find((card) => card.kind === "options");
  return (
    <div className="flex flex-col gap-1.5">
      {trace}
      {(text || options) && (
        <div className="flex w-full max-w-[600px] flex-col gap-3 rounded-[4px_12px_12px_12px] bg-white px-4 py-3 text-[14.5px] leading-[22px] hairline-soft">
          {text && <RichText text={text} />}
          {options && <QuickOptions options={options.options} interactive={interactive} onPick={onOption} />}
        </div>
      )}
      {children}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[520px] rounded-[12px_12px_4px_12px] bg-ink px-4 py-[11px] text-[14.5px] leading-[21px] whitespace-pre-line text-white">
        {text}
      </p>
    </div>
  );
}

function AnalystMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-2 text-[12.5px]">
        <span className="font-semibold">{message.authorName}</span>
        <span className="rounded-md bg-success-soft px-1.5 py-px text-[11px] font-semibold text-success-text">Analista</span>
        <span className="text-muted">{formatTime(message.createdAt)}</span>
      </p>
      <p className="max-w-[600px] rounded-[4px_12px_12px_12px] bg-bubble-human px-4 py-3 text-[14.5px] leading-[22px] whitespace-pre-line">
        {message.content}
      </p>
    </div>
  );
}

function SystemLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 py-1 text-[12px] font-medium text-muted">
      <span className="h-px flex-1 bg-ink/[0.08]" />
      <span className="flex items-center gap-1.5">
        <Headset className="size-3.5" /> {text}
      </span>
      <span className="h-px flex-1 bg-ink/[0.08]" />
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="font-serif text-[34px] leading-[38px] tracking-[-0.6px]">Como posso ajudar?</h1>
      <p className="max-w-[520px] text-[14.5px] leading-[22px] text-muted">
        Descreva o problema ou pergunte por um chamado. Eu consulto a central de ajuda e seus chamados, e chamo um analista
        quando for preciso.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onPick(suggestion)}
            className="rounded-lg bg-white px-3 py-[7px] text-[13.5px] font-medium hairline-soft hover:bg-accent-soft hover:text-primary-text"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
