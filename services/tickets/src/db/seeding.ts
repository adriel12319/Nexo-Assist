import type { Database } from "./client";
import { articles, tickets } from "./schema";
import { articlesSeed, ticketsSeed } from "./seed-data";

export async function seed(db: Database) {
  await db.delete(tickets);
  await db.delete(articles);
  await db.insert(articles).values(articlesSeed);
  await db.insert(tickets).values(ticketsSeed());
}

/** First boot against an empty database (a fresh Turso one, say) gets the sample data. */
export async function seedIfEmpty(db: Database) {
  const existing = await db.select({ id: articles.id }).from(articles).limit(1);
  if (existing.length === 0) await seed(db);
}
