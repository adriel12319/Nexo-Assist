import type { Client } from "@libsql/client";

const DDL = [
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_analyst_id TEXT,
    transfer TEXT,
    user_message_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations (user_id)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    author_name TEXT,
    content TEXT NOT NULL,
    cards TEXT NOT NULL,
    trace TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id)`,
  `CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    due_at TEXT,
    ticket_id TEXT,
    created_at TEXT NOT NULL
  )`,
];

export async function migrate(client: Client) {
  await client.batch(DDL, "write");
}
