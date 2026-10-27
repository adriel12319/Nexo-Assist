import "server-only";
import { type Person, type Ticket, findPerson } from "@nexo/shared";
import { TicketsServiceError } from "@nexo/tickets/client";
import { type Conversation, appendMessage, cancelPendingDrafts, getConversation, lastMessages, listConversations, loadState, setStatus } from "./conversations";
import type { ConversationListItem } from "@/lib/console-types";
import { HttpError } from "./session";
import { tickets } from "./tickets";

const toEmployee = (conversation: Conversation) => {
  const employee = findPerson(conversation.userId);
  if (!employee) throw new Error(`Unknown user ${conversation.userId}`);
  return employee;
};

export async function listForConsole(): Promise<ConversationListItem[]> {
  const rows = await listConversations();
  const last = await lastMessages(rows.map((row) => row.id));
  return rows.map((row) => {
    const message = last.get(row.id);
    return {
      id: row.id,
      status: row.status,
      employee: toEmployee(row),
      assignedAnalyst: row.assignedAnalystId ? (findPerson(row.assignedAnalystId) ?? null) : null,
      transfer: row.transfer,
      lastMessage: message ? { role: message.role, content: message.content, createdAt: message.createdAt } : null,
      updatedAt: row.updatedAt,
    };
  });
}

export async function getConsoleConversation(id: string) {
  const conversation = await getConversation(id);
  if (!conversation) throw new HttpError(404, "Conversa não encontrada.");
  const state = await loadState(conversation);
  const employee = toEmployee(conversation);

  let employeeTickets: Ticket[] | null = null;
  try {
    // O analista vê os chamados do funcionário que está atendendo, e só dele.
    employeeTickets = await tickets.list(employee.id);
  } catch (error) {
    if (!(error instanceof TicketsServiceError)) throw error;
  }

  return {
    ...state,
    employee,
    assignedAnalyst: conversation.assignedAnalystId ? (findPerson(conversation.assignedAnalystId) ?? null) : null,
    tickets: employeeTickets,
  };
}

async function load(id: string) {
  const conversation = await getConversation(id);
  if (!conversation) throw new HttpError(404, "Conversa não encontrada.");
  return conversation;
}

/** Once someone has taken a conversation, only they can hand it back or close it. */
function assertNotTakenByOther(conversation: Conversation, analyst: Person) {
  if (conversation.status === "with_analyst" && conversation.assignedAnalystId !== analyst.id) {
    throw new HttpError(409, "Outro analista está atendendo esta conversa.");
  }
}

const clock = () =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date());

export async function assume(analyst: Person, id: string) {
  const conversation = await load(id);
  if (conversation.status === "closed") throw new HttpError(409, "A conversa já foi encerrada.");
  if (conversation.status === "with_analyst" && conversation.assignedAnalystId !== analyst.id) {
    throw new HttpError(409, "Outro analista já assumiu esta conversa.");
  }
  await setStatus(id, "with_analyst", { assignedAnalystId: analyst.id });
  await appendMessage(id, { role: "system", content: `${analyst.name} assumiu · agent pausado · ${clock()}` });
}

export async function releaseToAgent(analyst: Person, id: string) {
  const conversation = await load(id);
  if (conversation.status === "closed") throw new HttpError(409, "A conversa já foi encerrada.");
  assertNotTakenByOther(conversation, analyst);
  await setStatus(id, "agent", { assignedAnalystId: null, transfer: null });
  await appendMessage(id, { role: "system", content: `${analyst.name} devolveu a conversa ao Nexo Assist · ${clock()}` });
}

export async function close(analyst: Person, id: string) {
  const conversation = await load(id);
  if (conversation.status === "closed") return;
  assertNotTakenByOther(conversation, analyst);
  await setStatus(id, "closed");
  await cancelPendingDrafts(id);
  await appendMessage(id, { role: "system", content: `Atendimento encerrado por ${analyst.name} · ${clock()}` });
}

export async function sendAnalystMessage(analyst: Person, id: string, content: string) {
  const conversation = await load(id);
  if (conversation.status !== "with_analyst" || conversation.assignedAnalystId !== analyst.id) {
    throw new HttpError(409, "Assuma o atendimento para responder.");
  }
  return appendMessage(id, { role: "analyst", authorName: analyst.name, content });
}
