import "server-only";
import { PRIORITY_LABEL, type Person, type Ticket, type Transfer } from "@nexo/shared";
import { TicketsServiceError } from "@nexo/tickets/client";
import { eq } from "drizzle-orm";
import { announceTransfer } from "./chat";
import { appendMessage, getConversation, getDraft, setStatus, settleDraft } from "./conversations";
import { db } from "./db/client";
import { drafts } from "./db/schema";
import { HttpError } from "./session";
import { tickets } from "./tickets";

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

async function loadOwnedDraft(user: Person, draftId: string) {
  const draft = await getDraft(draftId);
  const conversation = draft && (await getConversation(draft.conversationId));
  if (!draft || conversation?.userId !== user.id) throw new HttpError(404, "Rascunho não encontrado.");
  if (conversation.status === "closed") throw new HttpError(409, "Esta conversa foi encerrada. Comece uma nova para abrir o chamado.");
  return { draft, conversation };
}

export async function confirmDraft(user: Person, draftId: string) {
  const { draft, conversation } = await loadOwnedDraft(user, draftId);

  // Marca antes de chamar o serviço para que um duplo clique não abra dois chamados.
  if (!(await settleDraft(draft.id, "confirmed"))) throw new HttpError(409, "Este rascunho já foi confirmado ou descartado.");

  const idempotencyKey = `${conversation.id}/${draft.id}`;
  let ticket: Ticket;
  try {
    const { payload } = draft;
    ticket =
      payload.kind === "create"
        ? await tickets.create(user.id, payload.ticket, idempotencyKey)
        : await tickets.update(
            user.id,
            payload.ticketId,
            { message: payload.message, reopen: payload.kind === "reopen", priority: payload.priority, impact: payload.impact },
            idempotencyKey,
          );
  } catch (error) {
    // O rascunho volta a pendente; uma nova tentativa reusa a mesma chave de idempotência, então não duplica.
    await db.update(drafts).set({ status: "pending" }).where(eq(drafts.id, draft.id));
    if (error instanceof TicketsServiceError && error.unavailable) {
      throw new HttpError(503, "O sistema de chamados está instável. Tente confirmar de novo em instantes.");
    }
    throw error;
  }

  await db.update(drafts).set({ ticketId: ticket.id }).where(eq(drafts.id, draft.id));

  const due = ticket.dueAt ? timeFormat.format(new Date(ticket.dueAt)) : null;
  const content = {
    create: `Pronto: abri o ${ticket.id} com prioridade ${PRIORITY_LABEL[ticket.priority].toLowerCase()}.${due ? ` Um analista responde até ${due}.` : ""}`,
    update: `Registrei a nova informação no ${ticket.id}.${due ? ` Próxima atualização até ${due}.` : ""}`,
    reopen: `Reabri o ${ticket.id}. Um analista retoma o atendimento${due ? ` até ${due}` : ""}.`,
  }[draft.payload.kind];

  await appendMessage(conversation.id, {
    role: "agent",
    authorName: "Nexo Assist",
    content,
    cards: [{ kind: "ticket", ticket }],
    trace: {
      steps: [
        {
          tool: "tickets",
          label: { create: "criou o chamado", update: "atualizou o chamado", reopen: "reabriu o chamado" }[draft.payload.kind],
          detail: `${ticket.id} confirmado por ${user.name} a partir do rascunho ${draft.id}`,
          ok: true,
          durationMs: 0,
        },
      ],
    },
  });

  // Regra do service desk: caso crítico vai direto para um analista.
  if (ticket.priority === "critica" && conversation.status === "agent") {
    const transfer: Transfer = {
      reason: "critico",
      summary: `Chamado crítico ${ticket.id}: ${ticket.title}. ${ticket.description}`,
      confidence: null,
      ticketId: ticket.id,
      at: new Date().toISOString(),
    };
    await setStatus(conversation.id, "waiting_analyst", { transfer });
    await announceTransfer(conversation.id, transfer);
  }

  return ticket;
}

export async function cancelDraft(user: Person, draftId: string) {
  const { draft, conversation } = await loadOwnedDraft(user, draftId);
  if (!(await settleDraft(draft.id, "cancelled"))) throw new HttpError(409, "Este rascunho já foi confirmado ou descartado.");
  await appendMessage(conversation.id, {
    role: "agent",
    authorName: "Nexo Assist",
    content: "Tudo bem, descartei o rascunho. Se quiser, me diga o que mudar.",
  });
}
