import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { databaseConfig } from "./config";
import { migrate } from "./migrate";
import * as schema from "./schema";

const client = createClient(databaseConfig());

export const db = drizzle(client, { schema });

export const ready = migrate(client);
