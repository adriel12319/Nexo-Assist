import {
  type Article,
  type Category,
  type NewTicket,
  REOPEN_WINDOW_DAYS,
  type Ticket,
  type TicketUpdate,
  dueDate,
  isOpenStatus,
} from "@nexo/shared";
import { and, desc, eq, like } from "drizzle-orm";
import type { Database } from "./db/client";
import { type TicketRow, articles, tickets } from "./db/schema";
import { overlap, tokenize } from "./text";

const DAY_MS = 24 * 60 * 60 * 1000;

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

export function toTicket(row: TicketRow, now = new Date()): Ticket {
  return {
    ...row,
    overdue: isOpenStatus(row.status) && row.dueAt !== null && new Date(row.dueAt) < now,
  };
}

export function canReopen(ticket: Pick<Ticket, "status" | "resolvedAt">, now = new Date()) {
  if (isOpenStatus(ticket.status) || !ticket.resolvedAt) return false;
  return now.getTime() - new Date(ticket.resolvedAt).getTime() <= REOPEN_WINDOW_DAYS * DAY_MS;
}

export function createTicketRepository(db: Database) {
  async function findOwned(id: string, requesterId: string) {
    const row = await db.query.tickets.findFirst({
      where: and(eq(tickets.id, id.toUpperCase()), eq(tickets.requesterId, requesterId)),
    });
    // Mesmo erro para "não existe" e "é de outra pessoa": não revela a existência do chamado.
    if (!row) throw new NotFoundError(`Ticket ${id} not found`);
    return row;
  }

  async function nextId(type: NewTicket["type"]) {
    const [last] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(like(tickets.id, `${type}-%`))
      .orderBy(desc(tickets.id))
      .limit(1);
    const lastNumber = last ? Number(last.id.split("-")[1]) : type === "INC" ? 20000 : 10000;
    return `${type}-${lastNumber + 1}`;
  }

  return {
    async list(requesterId: string) {
      const rows = await db.query.tickets.findMany({
        where: eq(tickets.requesterId, requesterId),
        orderBy: desc(tickets.updatedAt),
      });
      return rows.map((row) => toTicket(row));
    },

    async get(id: string, requesterId: string) {
      return toTicket(await findOwned(id, requesterId));
    },

    /** Open tickets, or ones resolved recently enough to be reopened, about the same problem. */
    async findSimilar(requesterId: string, category: Category, text: string) {
      const queryTokens = tokenize(text);
      const now = new Date();
      const rows = await db.query.tickets.findMany({
        where: and(eq(tickets.requesterId, requesterId), eq(tickets.category, category)),
      });

      return rows
        .map((row) => toTicket(row, now))
        .filter((ticket) => isOpenStatus(ticket.status) || canReopen(ticket, now))
        .map((ticket) => {
          // Descrições longas diluem a cobertura da consulta; cobrir o título do chamado também conta.
          const queryCoverage = overlap(queryTokens, tokenize(`${ticket.title} ${ticket.description}`));
          const titleCoverage = overlap(tokenize(ticket.title), queryTokens);
          return {
            ticket,
            score: Math.max(queryCoverage, titleCoverage),
            matches: queryCoverage >= 0.3 || titleCoverage >= 0.6,
            canReopen: canReopen(ticket, now),
          };
        })
        .filter((match) => match.matches)
        .sort((a, b) => b.score - a.score)
        .map(({ matches: _, ...match }) => match);
    },

    async create(requesterId: string, input: NewTicket) {
      const now = new Date();
      const row: TicketRow = {
        ...input,
        id: await nextId(input.type),
        status: "aberto",
        requesterId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        resolvedAt: null,
        dueAt: dueDate(input.priority, now).toISOString(),
        events: [{ at: now.toISOString(), author: "Nexo Assist", message: "Chamado aberto pelo assistente." }],
      };
      await db.insert(tickets).values(row);
      return toTicket(row, now);
    },

    async update(id: string, requesterId: string, input: TicketUpdate) {
      const current = await findOwned(id, requesterId);
      const now = new Date();

      if (input.reopen && !canReopen(current, now)) {
        throw new ConflictError(`Ticket ${current.id} cannot be reopened`);
      }
      if (!input.reopen && !isOpenStatus(current.status)) {
        throw new ConflictError(`Ticket ${current.id} is closed`);
      }

      const priority = input.priority ?? current.priority;
      const changes = {
        priority,
        impact: input.impact ?? current.impact,
        status: input.reopen ? ("aberto" as const) : current.status,
        resolvedAt: input.reopen ? null : current.resolvedAt,
        updatedAt: now.toISOString(),
        dueAt: dueDate(priority, now).toISOString(),
        events: [
          ...current.events,
          { at: now.toISOString(), author: "Nexo Assist", message: input.reopen ? `Reaberto: ${input.message}` : input.message },
        ],
      };
      await db.update(tickets).set(changes).where(eq(tickets.id, current.id));
      return toTicket({ ...current, ...changes }, now);
    },
  };
}

export function createArticleRepository(db: Database) {
  return {
    async search(query: string, limit = 3): Promise<Array<Article & { score: number }>> {
      const queryTokens = tokenize(query);
      const rows = await db.select().from(articles);
      return rows
        .map((article) => {
          const title = overlap(queryTokens, tokenize(article.title));
          const tags = overlap(queryTokens, article.tags.flatMap(tokenize));
          const body = overlap(queryTokens, tokenize(article.body));
          return { ...article, score: Number((title * 0.4 + tags * 0.4 + body * 0.2).toFixed(2)) };
        })
        .filter((article) => article.score >= 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}
