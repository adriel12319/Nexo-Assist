import type { Ticket } from "@nexo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDatabase, migrate } from "./db/client";
import { articles, tickets } from "./db/schema";
import { articlesSeed, ticketsSeed } from "./db/seed-data";

const TOKEN = "test-token";

async function setup() {
  const { db, client } = createDatabase("file::memory:");
  await migrate(client);
  await db.insert(articles).values(articlesSeed);
  await db.insert(tickets).values(ticketsSeed());
  const app = createApp({ db, token: TOKEN });

  const call = (path: string, requesterId?: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
        ...(requesterId && { "x-requester-id": requesterId }),
        ...(init.headers as Record<string, string>),
      },
    });
  return { call };
}

describe("tickets service", () => {
  let call: Awaited<ReturnType<typeof setup>>["call"];

  beforeEach(async () => {
    ({ call } = await setup());
  });

  it("rejects calls without the service token", async () => {
    const { db, client } = createDatabase("file::memory:");
    await migrate(client);
    const response = await createApp({ db, token: TOKEN }).request("/tickets");
    expect(response.status).toBe(401);
  });

  it("lists only the requester's tickets", async () => {
    const list = (await (await call("/tickets", "u-ana")).json()) as Ticket[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((ticket) => ticket.requesterId === "u-ana")).toBe(true);
  });

  it("hides other people's tickets behind a 404", async () => {
    expect((await call("/tickets/INC-20402", "u-bruno")).status).toBe(200);
    expect((await call("/tickets/INC-20402", "u-ana")).status).toBe(404);
  });

  it("flags tickets past their SLA as overdue", async () => {
    const ticket = (await (await call("/tickets/INC-20311", "u-ana")).json()) as Ticket;
    expect(ticket.overdue).toBe(true);
  });

  it("creates tickets with sequential ids and an SLA deadline", async () => {
    const response = await call("/tickets", "u-ana", {
      method: "POST",
      body: JSON.stringify({
        type: "INC",
        title: "Impressora do 3º andar sem conexão",
        description: "A impressora NEXO-ANDAR-3 some da lista desde hoje cedo.",
        category: "Hardware",
        priority: "media",
        impact: "equipe",
      }),
    });
    const ticket = (await response.json()) as Ticket;
    expect(response.status).toBe(201);
    expect(ticket.id).toBe("INC-20403");
    expect(ticket.status).toBe("aberto");
    expect(ticket.dueAt).not.toBeNull();
  });

  it("finds an open ticket about the same problem", async () => {
    const query = new URLSearchParams({ category: "Hardware", text: "notebook muito lento depois da atualização" });
    const matches = (await (await call(`/tickets/similar?${query}`, "u-ana")).json()) as Array<{ ticket: Ticket }>;
    expect(matches[0]?.ticket.id).toBe("INC-20311");
  });

  it("still finds the open ticket when the description is long and detailed", async () => {
    const text =
      "Notebook lento após atualização do Windows. Já reiniciei várias vezes, rodei o diagnóstico, fechei os programas e mesmo assim demora uns 10 minutos para abrir o Excel, o que atrapalha o fechamento do mês da equipe financeira.";
    const query = new URLSearchParams({ category: "Hardware", text });
    const matches = (await (await call(`/tickets/similar?${query}`, "u-ana")).json()) as Array<{ ticket: Ticket }>;
    expect(matches[0]?.ticket.id).toBe("INC-20311");
  });

  it("replays a write retried with the same idempotency key instead of duplicating it", async () => {
    const body = JSON.stringify({
      type: "REQ",
      title: "Licença do Power BI",
      description: "Preciso de licença Pro do Power BI para os relatórios do time.",
      category: "Software",
      priority: "baixa",
      impact: "individual",
    });
    const post = () =>
      call("/tickets", "u-ana", { method: "POST", body, headers: { "idempotency-key": "conv-1/D-ABC" } } as RequestInit);

    const first = (await (await post()).json()) as Ticket;
    const second = (await (await post()).json()) as Ticket;
    const list = (await (await call("/tickets", "u-ana")).json()) as Ticket[];

    expect(second.id).toBe(first.id);
    expect(list.filter((ticket) => ticket.title === "Licença do Power BI")).toHaveLength(1);
  });

  it("offers reopening for tickets resolved in the last 7 days only", async () => {
    const recent = new URLSearchParams({ category: "Acesso", text: "senha do SAP bloqueada de novo" });
    const [match] = (await (await call(`/tickets/similar?${recent}`, "u-ana")).json()) as Array<{ ticket: Ticket; canReopen: boolean }>;
    expect(match).toMatchObject({ ticket: { id: "INC-20150" }, canReopen: true });

    const old = await call("/tickets/INC-19877/updates", "u-ana", {
      method: "POST",
      body: JSON.stringify({ message: "Voltou a acontecer", reopen: true }),
    });
    expect(old.status).toBe(409);
  });

  it("reopens a recently resolved ticket", async () => {
    const response = await call("/tickets/INC-20150/updates", "u-ana", {
      method: "POST",
      body: JSON.stringify({ message: "Bloqueou de novo hoje", reopen: true }),
    });
    const ticket = (await response.json()) as Ticket;
    expect(ticket.status).toBe("aberto");
    expect(ticket.resolvedAt).toBeNull();
    expect(ticket.events.at(-1)?.message).toContain("Reaberto");
  });

  it("searches the help center ignoring accents", async () => {
    const results = (await (await call("/articles/search?q=vpn%20erro%20809")).json()) as Array<{ id: string }>;
    expect(results[0]?.id).toBe("KB-001");
  });
});
