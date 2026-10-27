import type {
  Card,
  ConversationStatus,
  DraftPayload,
  DraftStatus,
  MessageRole,
  MessageTrace,
  Transfer,
} from "@nexo/shared";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    status: text("status").$type<ConversationStatus>().notNull(),
    assignedAnalystId: text("assigned_analyst_id"),
    transfer: text("transfer", { mode: "json" }).$type<Transfer>(),
    userMessageCount: integer("user_message_count").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("conversations_user_idx").on(table.userId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").$type<MessageRole>().notNull(),
    authorName: text("author_name"),
    content: text("content").notNull(),
    cards: text("cards", { mode: "json" }).$type<Card[]>().notNull(),
    trace: text("trace", { mode: "json" }).$type<MessageTrace>(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("messages_conversation_idx").on(table.conversationId)],
);

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  status: text("status").$type<DraftStatus>().notNull(),
  payload: text("payload", { mode: "json" }).$type<DraftPayload>().notNull(),
  dueAt: text("due_at"),
  ticketId: text("ticket_id"),
  createdAt: text("created_at").notNull(),
});

export type ConversationRow = typeof conversations.$inferSelect;
