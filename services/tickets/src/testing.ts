import { createApp } from "./app";
import { createTicketsClient } from "./client";
import { createDatabase, migrate } from "./db/client";
import { seed } from "./db/seeding";

/** A seeded tickets service running in memory, reached through the real HTTP client. */
export async function createInMemoryTicketsClient() {
  const { db, client } = createDatabase("file::memory:");
  await migrate(client);
  await seed(db);

  const app = createApp({ db, token: "in-memory" });
  return createTicketsClient({
    baseUrl: "http://tickets.local",
    token: "in-memory",
    fetch: async (input, init) => app.request(String(input), init),
  });
}
