import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const DDL = [
  `CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    impact TEXT NOT NULL,
    status TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT,
    due_at TEXT,
    events TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS tickets_requester_idx ON tickets (requester_id)`,
  `CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL,
    status INTEGER,
    body TEXT,
    created_at TEXT NOT NULL
  )`,
];

// Na Vercel, a integração do Turso injeta TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.
export function createDatabase(
  url = process.env.TICKETS_DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? "file:../../data/tickets.db",
) {
  const authToken = url.startsWith("file:")
    ? undefined
    : (process.env.TICKETS_DATABASE_TOKEN ?? process.env.TURSO_AUTH_TOKEN);
  const client = createClient({ url, authToken });
  return { db: drizzle(client, { schema }), client };
}

export type Database = ReturnType<typeof createDatabase>["db"];

export async function migrate(client: ReturnType<typeof createDatabase>["client"]) {
  await client.batch(DDL, "write");
}
