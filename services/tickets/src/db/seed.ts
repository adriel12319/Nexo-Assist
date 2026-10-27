import { createDatabase, migrate } from "./client";
import { seed } from "./seeding";

const { db, client } = createDatabase();
await migrate(client);
await seed(db);

console.log("Seeded help center articles and sample tickets.");
client.close();
