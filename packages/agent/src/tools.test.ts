import { type Draft, type DraftPayload, PEOPLE, type Ticket } from "@nexo/shared";
import { TicketsServiceError, type TicketsClient } from "@nexo/tickets/client";
import { describe, expect, it, vi } from "vitest";
import type { AgentContext } from "./context";
import { TurnRecorder } from "./recorder";
import { createTools } from "./tools";

const ana = PEOPLE[0]!;

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: "INC-20311",
  type: "INC",
  title: "Notebook lento após atualização",
  description: "Lento desde a atualização",
  category: "Hardware",
  priority: "media",
  impact: "individual",
  status: "aguardando_analista",
  requesterId: ana.id,
  createdAt: "2026-10-20T13:00:00Z",
  updatedAt: "2026-10-21T13:00:00Z",
  resolvedAt: null,
  dueAt: "2026-10-24T13:00:00Z",
  overdue: true,
  events: [],
  ...overrides,
});

function setup(tickets: Partial<TicketsClient> = {}) {
  const saveDraft = vi.fn(
    async (payload: DraftPayload, dueAt: Date | null): Promise<Draft> => ({
      id: "D-TEST",
      conversationId: "c1",
      status: "pending",
      payload,
      dueAt: dueAt?.toISOString() ?? null,
      ticketId: null,
      createdAt: new Date().toISOString(),
    }),
  );
  const requestTransfer = vi.fn(async () => {});
  const ctx: AgentContext = {
    user: ana,
    tickets: { findSimilar: vi.fn(async () => []), ...tickets } as TicketsClient,
    conversation: { saveDraft, requestTransfer },
    now: () => new Date("2026-10-27T13:00:00Z"),
  };
  const recorder = new TurnRecorder();
  return { tools: createTools(ctx, recorder), recorder, saveDraft, requestTransfer, ctx };
}

// O segundo argumento é o contexto de execução do Mastra; as ferramentas não dependem dele.
const run = <I, O>(tool: { execute?: (input: I, context: never) => Promise<O> }, input: I) =>
  tool.execute!(input, {} as never);

const newTicket = {
  type: "INC" as const,
  category: "Rede e VPN" as const,
  title: "VPN não conecta — erro 809",
  description: "Desde ontem o notebook com Windows 11 não conecta na VPN e mostra o erro 809.",
  impact: "individual" as const,
  blocksWork: false,
  deadlineToday: true,
  notSameAs: [] as string[],
};

describe("draftNewTicket", () => {
  it("classifies priority in code and saves a draft instead of creating the ticket", async () => {
    const { tools, saveDraft, recorder } = setup();
    const result = await run(tools.draftNewTicket, newTicket);

    expect(result).toMatchObject({ duplicate: false, draftId: "D-TEST", priority: "Alta" });
    expect(saveDraft.mock.calls[0]?.[0]).toMatchObject({ kind: "create", ticket: { priority: "alta" } });
    expect(recorder.cards).toEqual([{ kind: "draft", draftId: "D-TEST" }]);
    expect(recorder.steps.map((step) => step.label)).toEqual([
      "classificou a prioridade",
      "consultou o SLA",
      "montou o rascunho",
    ]);
  });

  it("refuses to draft a duplicate of an open ticket", async () => {
    const { tools, saveDraft } = setup({
      findSimilar: vi.fn(async () => [{ ticket: ticket({ category: "Rede e VPN" }), score: 0.8, canReopen: false }]),
    });
    const result = await run(tools.draftNewTicket, newTicket);

    expect(result).toMatchObject({ duplicate: true, canReopen: false });
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("lets the employee say a similar ticket is a different problem", async () => {
    const { tools, saveDraft } = setup({
      findSimilar: vi.fn(async () => [{ ticket: ticket({ category: "Rede e VPN" }), score: 0.8, canReopen: false }]),
    });
    await run(tools.draftNewTicket, { ...newTicket, notSameAs: ["INC-20311"] });
    expect(saveDraft).toHaveBeenCalled();
  });

  it("asks only for the current user's similar tickets", async () => {
    const { tools, ctx } = setup();
    await run(tools.draftNewTicket, newTicket);
    expect(ctx.tickets.findSimilar).toHaveBeenCalledWith(ana.id, "Rede e VPN", expect.any(String));
  });
});

describe("draftTicketUpdate", () => {
  it("only raises priority, never lowers it", async () => {
    const { tools, saveDraft } = setup({ get: vi.fn(async () => ticket({ priority: "alta" })) });
    await run(tools.draftTicketUpdate, {
      ticketId: "INC-20311",
      message: "Agora também trava ao abrir o Excel",
      reopen: false,
      raisePriority: { impact: "individual", blocksWork: false, deadlineToday: false },
    });
    expect(saveDraft.mock.calls[0]?.[0]).toMatchObject({ kind: "update" });
    expect(saveDraft.mock.calls[0]?.[0]).not.toHaveProperty("priority");
  });

  it("raises a reopened ticket to critical when it now stops the whole company", async () => {
    const { tools, saveDraft } = setup({
      get: vi.fn(async () => ticket({ id: "INC-20150", status: "resolvido", resolvedAt: "2026-10-23T13:00:00Z" })),
    });
    const result = await run(tools.draftTicketUpdate, {
      ticketId: "INC-20150",
      message: "O SAP bloqueou para todo mundo e o fechamento é hoje",
      reopen: true,
      raisePriority: { impact: "empresa", blocksWork: true, deadlineToday: true },
    });

    expect(saveDraft.mock.calls[0]?.[0]).toMatchObject({ kind: "reopen", priority: "critica", impact: "empresa" });
    expect(saveDraft.mock.calls[0]?.[1]?.toISOString()).toBe("2026-10-27T14:00:00.000Z");
    expect(result).toHaveProperty("instruction");
  });

  it("does not update closed tickets", async () => {
    const { tools, saveDraft } = setup({ get: vi.fn(async () => ticket({ status: "resolvido" })) });
    const result = await run(tools.draftTicketUpdate, { ticketId: "INC-20311", message: "Voltou a acontecer", reopen: false });
    expect(result).toHaveProperty("error");
    expect(saveDraft).not.toHaveBeenCalled();
  });
});

describe("service outages", () => {
  it("turns an unavailable tickets service into an explainable result", async () => {
    const { tools, recorder } = setup({
      list: vi.fn(async () => {
        throw new TicketsServiceError("down", 503);
      }),
    });
    const result = await run(tools.listMyTickets, { onlyOpen: true, askToPick: false });

    expect(result).toHaveProperty("error");
    expect(recorder.steps[0]).toMatchObject({ ok: false, label: "sistema de chamados indisponível" });
  });

  it("reports someone else's ticket as not found", async () => {
    const { tools } = setup({
      get: vi.fn(async () => {
        throw new TicketsServiceError("not found", 404);
      }),
    });
    const result = await run(tools.getTicket, { ticketId: "inc-20402" });
    expect(result).toEqual({ error: expect.stringContaining("não encontrado") });
  });
});

describe("transferToAnalyst", () => {
  it("hands the summary to the conversation", async () => {
    const { tools, requestTransfer } = setup();
    await run(tools.transferToAnalyst, {
      reason: "chamado_vencido",
      summary: "INC-20311 está vencido há 3 dias e a funcionária pediu para falar com alguém.",
      confidence: 0.9,
      ticketId: "INC-20311",
    });
    expect(requestTransfer).toHaveBeenCalledWith(expect.objectContaining({ reason: "chamado_vencido", ticketId: "INC-20311" }));
  });
});
