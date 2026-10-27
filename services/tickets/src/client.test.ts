import { describe, expect, it, vi } from "vitest";
import { TicketsServiceError, createTicketsClient } from "./client";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const clientWith = (fetch: typeof globalThis.fetch) =>
  createTicketsClient({ baseUrl: "http://tickets", token: "t", backoffMs: 1, fetch });

describe("tickets client", () => {
  it("retries reads while the legacy service is unavailable", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json(503, { error: "down" }))
      .mockResolvedValueOnce(json(503, { error: "down" }))
      .mockResolvedValueOnce(json(200, []));

    await expect(clientWith(fetch).list("u-ana")).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("gives up after the retry budget and reports the outage", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(503, { error: "down" }));
    const error = await clientWith(fetch).list("u-ana").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(TicketsServiceError);
    expect((error as TicketsServiceError).unavailable).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("does not retry client errors", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(404, { error: "not found" }));
    await expect(clientWith(fetch).get("u-ana", "INC-1")).rejects.toMatchObject({ status: 404 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("never repeats a write whose outcome is unknown", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("socket hang up"));
    await expect(
      clientWith(fetch).update("u-ana", "INC-1", { message: "Mais detalhes" }),
    ).rejects.toBeInstanceOf(TicketsServiceError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a write after a timeout when it carries an idempotency key", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error("The operation was aborted due to timeout"))
      .mockResolvedValueOnce(json(201, { id: "INC-1" }));

    await expect(
      clientWith(fetch).create("u-ana", { type: "INC", title: "Teste", description: "Descrição de teste", category: "Outros", priority: "baixa", impact: "individual" }, "c1/D-1"),
    ).resolves.toEqual({ id: "INC-1" });
    const headers = fetch.mock.calls[1]?.[1]?.headers as Headers;
    expect(headers.get("idempotency-key")).toBe("c1/D-1");
  });

  it("sends the requester so the service can scope the data", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(200, []));
    await clientWith(fetch).list("u-ana");
    const headers = fetch.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("x-requester-id")).toBe("u-ana");
  });
});
