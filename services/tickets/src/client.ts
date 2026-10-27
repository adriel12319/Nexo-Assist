import type { Article, Category, NewTicket, Ticket, TicketUpdate } from "@nexo/shared";

export class TicketsServiceError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }

  get unavailable() {
    return this.status === null || this.status >= 500;
  }
}

export interface SimilarTicket {
  ticket: Ticket;
  score: number;
  canReopen: boolean;
}

interface ClientOptions {
  baseUrl: string;
  /** A function is resolved on each request, so a missing secret fails at use, not at import. */
  token: string | (() => string);
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createTicketsClient({
  baseUrl,
  token,
  retries = 3,
  backoffMs = 250,
  timeoutMs = 5000,
  fetch: fetchImpl = fetch,
}: ClientOptions) {
  async function request<T>(
    path: string,
    init: RequestInit & { requesterId?: string; idempotencyKey?: string } = {},
  ): Promise<T> {
    const { requesterId, idempotencyKey, ...rest } = init;
    const headers = new Headers(rest.headers);
    headers.set("authorization", `Bearer ${typeof token === "function" ? token() : token}`);
    headers.set("content-type", "application/json");
    if (requesterId) headers.set("x-requester-id", requesterId);
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);

    // Com chave de idempotência, repetir uma escrita devolve o mesmo resultado em vez de duplicar.
    const safeToRetry = !rest.method || rest.method === "GET" || Boolean(idempotencyKey);
    let lastError = new TicketsServiceError("Unknown error", null);

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(backoffMs * 2 ** (attempt - 1) + Math.random() * 100);

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}${path}`, { ...rest, headers, signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        lastError = new TicketsServiceError(error instanceof Error ? error.message : String(error), null);
        if (!safeToRetry) throw lastError;
        continue;
      }

      if (response.ok) return (await response.json()) as T;

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      lastError = new TicketsServiceError(body.error ?? response.statusText, response.status);
      if (!RETRYABLE.has(response.status) || (!safeToRetry && response.status !== 503)) throw lastError;
    }
    throw lastError;
  }

  return {
    list: (requesterId: string) => request<Ticket[]>("/tickets", { requesterId }),

    get: (requesterId: string, id: string) =>
      request<Ticket>(`/tickets/${encodeURIComponent(id)}`, { requesterId }),

    findSimilar: (requesterId: string, category: Category, text: string) =>
      request<SimilarTicket[]>(
        `/tickets/similar?${new URLSearchParams({ category, text })}`,
        { requesterId },
      ),

    create: (requesterId: string, input: NewTicket, idempotencyKey?: string) =>
      request<Ticket>("/tickets", { method: "POST", body: JSON.stringify(input), requesterId, idempotencyKey }),

    update: (requesterId: string, id: string, input: TicketUpdate, idempotencyKey?: string) =>
      request<Ticket>(`/tickets/${encodeURIComponent(id)}/updates`, {
        method: "POST",
        body: JSON.stringify(input),
        requesterId,
        idempotencyKey,
      }),

    searchArticles: (query: string) =>
      request<Array<Article & { score: number }>>(`/articles/search?${new URLSearchParams({ q: query })}`),
  };
}

export type TicketsClient = ReturnType<typeof createTicketsClient>;
