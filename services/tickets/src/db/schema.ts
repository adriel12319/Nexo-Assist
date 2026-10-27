import type { Category, Impact, Priority, TicketEvent, TicketStatus, TicketType } from "@nexo/shared";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  type: text("type").$type<TicketType>().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").$type<Category>().notNull(),
  priority: text("priority").$type<Priority>().notNull(),
  impact: text("impact").$type<Impact>().notNull(),
  status: text("status").$type<TicketStatus>().notNull(),
  requesterId: text("requester_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  resolvedAt: text("resolved_at"),
  dueAt: text("due_at"),
  events: text("events", { mode: "json" }).$type<TicketEvent[]>().notNull(),
});

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").$type<Category>().notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
});

/** Responses to writes, keyed by the caller's idempotency key, so a retried write returns the first result. */
export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  requesterId: text("requester_id").notNull(),
  status: integer("status"),
  body: text("body"),
  createdAt: text("created_at").notNull(),
});

export type TicketRow = typeof tickets.$inferSelect;
