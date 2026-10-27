import "server-only";
import { z } from "zod";
import { HttpError } from "./session";

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return Response.json({ error: "Requisição inválida." }, { status: 400 });
  console.error(error);
  return Response.json({ error: "Erro inesperado. Tente de novo." }, { status: 500 });
}

/** Wraps a route handler so domain errors become JSON responses with the right status. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/** Small in-memory limiter: enough to stop a runaway client from burning the model quota. */
export function rateLimit(key: string, max: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= max) throw new HttpError(429, "Muitas mensagens em pouco tempo. Aguarde um minuto.");
  recent.push(now);
  hits.set(key, recent);
}
