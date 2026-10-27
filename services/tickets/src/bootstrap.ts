import { Hono } from "hono";
import { createApp } from "./app";
import { createDatabase, migrate } from "./db/client";
import { seedIfEmpty } from "./db/seeding";

function serviceToken() {
  const token = process.env.TICKETS_SERVICE_TOKEN;
  if (token) return token;
  if (process.env.NODE_ENV === "production") throw new Error("TICKETS_SERVICE_TOKEN must be set in production");
  return "dev-token";
}

/** The service as deployed: migrates and seeds on first request, then serves the app. */
export function createService() {
  const { db, client } = createDatabase();
  const ready = migrate(client).then(() => seedIfEmpty(db));

  const service = new Hono();
  service.use("*", async (_c, next) => {
    await ready;
    await next();
  });
  service.route(
    "/",
    createApp({
      db,
      token: serviceToken(),
      failureRate: Number(process.env.TICKETS_FAILURE_RATE ?? 0.1),
      latencyMs: [80, 600],
    }),
  );
  return service;
}
