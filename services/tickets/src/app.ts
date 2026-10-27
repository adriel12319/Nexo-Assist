import { categorySchema, newTicketSchema, ticketUpdateSchema } from "@nexo/shared";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Database } from "./db/client";
import { idempotent } from "./idempotency";
import { ConflictError, NotFoundError, createArticleRepository, createTicketRepository } from "./repository";

interface AppOptions {
  db: Database;
  token: string;
  failureRate?: number;
  latencyMs?: [min: number, max: number];
}

const requesterHeader = "x-requester-id";

export function createApp({ db, token, failureRate = 0, latencyMs = [0, 0] }: AppOptions) {
  const ticketsRepo = createTicketRepository(db);
  const articlesRepo = createArticleRepository(db);
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.use("*", bearerAuth({ token }));

  // Simula o sistema legado: latência variável e indisponibilidade ocasional.
  app.use("*", async (c, next) => {
    const [min, max] = latencyMs;
    if (max > 0) await new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
    if (Math.random() < failureRate) return c.json({ error: "Service temporarily unavailable" }, 503);
    await next();
  });

  const tickets = new Hono<{ Variables: { requesterId: string } }>();

  tickets.use("*", async (c, next) => {
    const requesterId = c.req.header(requesterHeader);
    if (!requesterId) return c.json({ error: `Missing ${requesterHeader} header` }, 400);
    c.set("requesterId", requesterId);
    await next();
  });

  tickets.use("*", idempotent(db));

  tickets.get("/", async (c) => c.json(await ticketsRepo.list(c.var.requesterId)));

  tickets.get("/similar", async (c) => {
    const query = z
      .object({ category: categorySchema, text: z.string().min(1) })
      .parse({ category: c.req.query("category"), text: c.req.query("text") });
    return c.json(await ticketsRepo.findSimilar(c.var.requesterId, query.category, query.text));
  });

  tickets.get("/:id", async (c) => c.json(await ticketsRepo.get(c.req.param("id"), c.var.requesterId)));

  tickets.post("/", async (c) => {
    const input = newTicketSchema.parse(await c.req.json());
    return c.json(await ticketsRepo.create(c.var.requesterId, input), 201);
  });

  tickets.post("/:id/updates", async (c) => {
    const input = ticketUpdateSchema.parse(await c.req.json());
    return c.json(await ticketsRepo.update(c.req.param("id"), c.var.requesterId, input));
  });

  app.route("/tickets", tickets);

  app.get("/articles/search", async (c) => c.json(await articlesRepo.search(c.req.query("q") ?? "")));

  app.onError((error, c) => {
    if (error instanceof NotFoundError) return c.json({ error: error.message }, 404);
    if (error instanceof ConflictError) return c.json({ error: error.message }, 409);
    if (error instanceof z.ZodError) return c.json({ error: "Invalid request", issues: error.issues }, 400);
    if (error instanceof HTTPException) return error.getResponse();
    console.error(error);
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}
