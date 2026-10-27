import "server-only";
import { type TurnEvent, runAgentTurn } from "@nexo/agent";
import { type Draft, MESSAGE_LIMIT, type Person, TRANSFER_REASON_LABEL, type Transfer } from "@nexo/shared";
import {
  appendMessage,
  createDraft,
  findActiveConversation,
  loadState,
  setStatus,
  startConversation,
} from "./conversations";
import { HttpError } from "./session";
import { tickets } from "./tickets";

export type ChatEvent = TurnEvent | { type: "draft"; draft: Draft } | { type: "done" } | { type: "error"; message: string };

const FALLBACK_REPLY =
  "Tive um problema para processar sua mensagem agora. Tente de novo em instantes; se for urgente, ligue no ramal 4000.";

export async function handleUserMessage(user: Person, text: string, emit: (event: ChatEvent) => void) {
  const conversation = (await findActiveConversation(user.id)) ?? (await startConversation(user.id));
  if (conversation.userMessageCount >= MESSAGE_LIMIT) {
    throw new HttpError(429, `Esta conversa atingiu o limite de ${MESSAGE_LIMIT} mensagens.`);
  }

  await appendMessage(conversation.id, { role: "user", content: text });

  // Com um analista na conversa, o agent fica em silêncio.
  if (conversation.status !== "agent") {
    emit({ type: "done" });
    return;
  }

  const state = await loadState(conversation);
  let transfer: Transfer | null = null;

  try {
    const turn = await runAgentTurn(
      {
        user,
        tickets,
        conversation: {
          async saveDraft(payload, dueAt) {
            const draft = await createDraft(conversation.id, payload, dueAt);
            emit({ type: "draft", draft });
            return draft;
          },
          async requestTransfer(request) {
            transfer = { ...request, at: new Date().toISOString() };
            await setStatus(conversation.id, "waiting_analyst", { transfer });
          },
        },
      },
      state,
      emit,
    );

    await appendMessage(conversation.id, {
      role: "agent",
      authorName: "Nexo Assist",
      content: turn.text || (turn.cards.length ? "" : FALLBACK_REPLY),
      cards: turn.cards,
      trace: turn.trace,
    });
  } catch (error) {
    console.error("Agent turn failed", error);
    await appendMessage(conversation.id, {
      role: "agent",
      authorName: "Nexo Assist",
      content: FALLBACK_REPLY,
      trace: { steps: [{ tool: "agent", label: "não conseguiu responder", detail: describeError(error), ok: false, durationMs: 0 }] },
    });
  }

  if (transfer) await announceTransfer(conversation.id, transfer);
  emit({ type: "done" });
}

export async function announceTransfer(conversationId: string, transfer: Transfer) {
  await appendMessage(conversationId, {
    role: "system",
    content: `Transferida para o service desk · ${TRANSFER_REASON_LABEL[transfer.reason]}`,
  });
}

function describeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota|rate|429|exhausted/i.test(message)) return "Limite de uso do modelo atingido";
  if (/api key|401|403|permission/i.test(message)) return "Chave do modelo inválida ou ausente";
  return message.slice(0, 200);
}
