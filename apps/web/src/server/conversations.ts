import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import type { Card, ChatMessage, ConversationStatus, Draft, DraftPayload, MessageRole, MessageTrace, Transfer } from "@nexo/shared";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, ready } from "./db/client";
import { type ConversationRow, conversations, drafts, messages } from "./db/schema";

export type Conversation = ConversationRow;

export interface ConversationState {
  conversation: Conversation | null;
  messages: ChatMessage[];
  drafts: Record<string, Draft>;
}

const now = () => new Date().toISOString();
const draftId = () => `D-${randomBytes(3).toString("hex").toUpperCase()}`;

export async function findActiveConversation(userId: string) {
  await ready;
  return db.query.conversations.findFirst({
    where: and(eq(conversations.userId, userId), ne(conversations.status, "closed")),
    orderBy: desc(conversations.createdAt),
  });
}

export async function getConversation(id: string) {
  await ready;
  return db.query.conversations.findFirst({ where: eq(conversations.id, id) });
}

export async function startConversation(userId: string): Promise<Conversation> {
  await ready;
  const row: Conversation = {
    id: randomUUID(),
    userId,
    status: "agent",
    assignedAnalystId: null,
    transfer: null,
    userMessageCount: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(conversations).values(row);
  return row;
}

export async function loadState(conversation: Conversation | null | undefined): Promise<ConversationState> {
  if (!conversation) return { conversation: null, messages: [], drafts: {} };
  const [messageRows, draftRows] = await Promise.all([
    db.query.messages.findMany({ where: eq(messages.conversationId, conversation.id), orderBy: asc(messages.createdAt) }),
    db.query.drafts.findMany({ where: eq(drafts.conversationId, conversation.id) }),
  ]);
  return {
    conversation,
    messages: messageRows,
    drafts: Object.fromEntries(draftRows.map((draft) => [draft.id, draft])),
  };
}

export async function appendMessage(
  conversationId: string,
  message: { role: MessageRole; content: string; authorName?: string | null; cards?: Card[]; trace?: MessageTrace | null },
): Promise<ChatMessage> {
  const row: ChatMessage = {
    id: randomUUID(),
    conversationId,
    role: message.role,
    authorName: message.authorName ?? null,
    content: message.content,
    cards: message.cards ?? [],
    trace: message.trace ?? null,
    createdAt: now(),
  };
  await db.batch([
    db.insert(messages).values(row),
    db
      .update(conversations)
      .set({
        updatedAt: row.createdAt,
        ...(row.role === "user" && { userMessageCount: sql`${conversations.userMessageCount} + 1` }),
      })
      .where(eq(conversations.id, conversationId)),
  ]);
  return row;
}

export async function setStatus(
  conversationId: string,
  status: ConversationStatus,
  changes: { assignedAnalystId?: string | null; transfer?: Transfer | null } = {},
) {
  await db
    .update(conversations)
    .set({ status, ...changes, updatedAt: now() })
    .where(eq(conversations.id, conversationId));
}

export async function createDraft(conversationId: string, payload: DraftPayload, dueAt: Date | null): Promise<Draft> {
  const row: Draft = {
    id: draftId(),
    conversationId,
    status: "pending",
    payload,
    dueAt: dueAt?.toISOString() ?? null,
    ticketId: null,
    createdAt: now(),
  };
  // Um rascunho novo substitui os pendentes: só o último pode ser confirmado.
  await db.batch([cancelPending(conversationId), db.insert(drafts).values(row)]);
  return row;
}

const cancelPending = (conversationId: string) =>
  db
    .update(drafts)
    .set({ status: "cancelled" })
    .where(and(eq(drafts.conversationId, conversationId), eq(drafts.status, "pending")));

export async function cancelPendingDrafts(conversationId: string) {
  await cancelPending(conversationId);
}

export async function getDraft(id: string) {
  await ready;
  return db.query.drafts.findFirst({ where: eq(drafts.id, id) });
}

/** Moves a pending draft to a final status; returns false if someone else already did. */
export async function settleDraft(id: string, status: Draft["status"], ticketId: string | null = null) {
  const result = await db
    .update(drafts)
    .set({ status, ticketId })
    .where(and(eq(drafts.id, id), eq(drafts.status, "pending")));
  return result.rowsAffected > 0;
}

export async function listConversations() {
  await ready;
  return db.query.conversations.findMany({ orderBy: desc(conversations.updatedAt), limit: 100 });
}

export async function lastMessages(conversationIds: string[]) {
  const rows = conversationIds.length
    ? await db.query.messages.findMany({
        where: and(inArray(messages.conversationId, conversationIds), ne(messages.role, "system")),
        orderBy: asc(messages.createdAt),
      })
    : [];
  return new Map(rows.map((message) => [message.conversationId, message]));
}
