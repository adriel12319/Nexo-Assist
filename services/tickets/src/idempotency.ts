import { and, eq, isNull } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Database } from "./db/client";
import { idempotencyKeys } from "./db/schema";

export const IDEMPOTENCY_HEADER = "idempotency-key";

/**
 * Replays the stored response when a write is retried with the same key. The key is reserved before
 * the write runs, so two concurrent attempts can't both go through.
 */
export function idempotent(db: Database) {
  return createMiddleware<{ Variables: { requesterId: string } }>(async (c, next) => {
    const key = c.req.header(IDEMPOTENCY_HEADER);
    if (c.req.method !== "POST" || !key) return next();

    const requesterId = c.var.requesterId;
    const reserved = await db
      .insert(idempotencyKeys)
      .values({ key, requesterId, createdAt: new Date().toISOString() })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });

    if (reserved.length === 0) {
      const existing = await db.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.key, key) });
      if (existing?.requesterId !== requesterId) return c.json({ error: "Idempotency key already used" }, 422);
      if (existing.status === null || existing.body === null) {
        return c.json({ error: "Request with this key is still in progress" }, 503);
      }
      return c.body(existing.body, existing.status as 200, { "content-type": "application/json" });
    }

    await next();

    if (c.res.ok) {
      const body = await c.res.clone().text();
      await db.update(idempotencyKeys).set({ status: c.res.status, body }).where(eq(idempotencyKeys.key, key));
    } else {
      // Falhou sem gravar: libera a chave para uma nova tentativa.
      await db.delete(idempotencyKeys).where(and(eq(idempotencyKeys.key, key), isNull(idempotencyKeys.status)));
    }
  });
}
