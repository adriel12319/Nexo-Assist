import { type Card, type ChatMessage, type Draft, PRIORITY_LABEL, STATUS_LABEL } from "@nexo/shared";
import { formatDateTime } from "./format";

const HISTORY_WINDOW = 20;

type ModelMessage = { role: "user"; content: string } | { role: "assistant"; content: string };

const DRAFT_STATUS = { pending: "pendente", confirmed: "confirmado", cancelled: "descartado", failed: "falhou" } as const;

/** What the employee saw on a card, as a line the model can read back. Without it the model guesses dates. */
function describeCard(card: Card, drafts: Record<string, Draft>): string | null {
  switch (card.kind) {
    case "ticket": {
      const { ticket } = card;
      const due = ticket.dueAt ? ` · próxima atualização até ${formatDateTime(ticket.dueAt)}` : "";
      return `[Card do chamado ${ticket.id}: ${ticket.title} · ${STATUS_LABEL[ticket.status]} · prioridade ${PRIORITY_LABEL[ticket.priority]}${due}${ticket.overdue ? " · prazo vencido" : ""}]`;
    }
    case "ticket-picker":
      return `[Seletor mostrado com: ${card.tickets.map((ticket) => `${ticket.id} ${ticket.title}`).join("; ")}]`;
    case "options":
      return `[Opções mostradas: ${card.options.join(" | ")}]`;
    case "draft": {
      const draft = drafts[card.draftId];
      if (!draft) return null;
      const { payload } = draft;
      const subject = payload.kind === "create" ? `${payload.ticket.title} · ${payload.ticket.category}` : `${payload.kind === "reopen" ? "reabrir" : "atualizar"} ${payload.ticketId}`;
      const priority = payload.kind === "create" ? payload.ticket.priority : payload.priority;
      const details = [
        priority && `prioridade ${PRIORITY_LABEL[priority]}`,
        draft.dueAt && `resposta até ${formatDateTime(draft.dueAt)}`,
        draft.ticketId && `virou ${draft.ticketId}`,
      ].filter(Boolean);
      return `[Rascunho ${draft.id} (${DRAFT_STATUS[draft.status]}): ${subject}${details.length ? ` · ${details.join(" · ")}` : ""}]`;
    }
  }
}

/** Maps the stored conversation to what the model sees. Analyst and system lines become context, not instructions. */
export function toModelMessages(history: ChatMessage[], drafts: Record<string, Draft> = {}): ModelMessage[] {
  return history.slice(-HISTORY_WINDOW).flatMap((message): ModelMessage[] => {
    switch (message.role) {
      case "user":
        return [{ role: "user", content: message.content }];
      case "agent": {
        const content = [message.content, ...message.cards.map((card) => describeCard(card, drafts))]
          .filter(Boolean)
          .join("\n");
        return content ? [{ role: "assistant", content }] : [];
      }
      case "analyst":
        return [{ role: "assistant", content: `[Analista ${message.authorName ?? ""}] ${message.content}` }];
      case "system":
        return [{ role: "assistant", content: `[Registro do sistema] ${message.content}` }];
    }
  });
}
