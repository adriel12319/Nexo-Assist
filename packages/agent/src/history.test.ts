import type { ChatMessage, Draft } from "@nexo/shared";
import { describe, expect, it } from "vitest";
import { toModelMessages } from "./history";

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: "m1",
  conversationId: "c1",
  role: "agent",
  authorName: "Nexo Assist",
  content: "",
  cards: [],
  trace: null,
  createdAt: "2026-10-27T13:00:00Z",
  ...overrides,
});

const draft: Draft = {
  id: "D-1",
  conversationId: "c1",
  status: "pending",
  payload: {
    kind: "create",
    ticket: { type: "INC", title: "Notebook não liga", description: "Não liga desde ontem.", category: "Hardware", priority: "media", impact: "individual" },
    priorityReason: "Atrapalha, mas há alternativa",
  },
  dueAt: "2026-10-30T13:00:00Z",
  ticketId: null,
  createdAt: "2026-10-27T13:00:00Z",
};

describe("toModelMessages", () => {
  it("gives the model the draft's deadline so it doesn't have to guess it", () => {
    const [entry] = toModelMessages(
      [message({ content: "Confira o rascunho:", cards: [{ kind: "draft", draftId: "D-1" }] })],
      { "D-1": draft },
    );
    expect(entry?.content).toContain("Rascunho D-1 (pendente)");
    expect(entry?.content).toContain("prioridade Média");
    expect(entry?.content).toContain("30 de out");
  });

  it("keeps agent messages that only showed a card", () => {
    const entries = toModelMessages([message({ cards: [{ kind: "options", options: ["Só eu", "Minha equipe"] }] })]);
    expect(entries).toEqual([{ role: "assistant", content: "[Opções mostradas: Só eu | Minha equipe]" }]);
  });

  it("marks analyst messages as context", () => {
    const [entry] = toModelMessages([message({ role: "analyst", authorName: "Rafael Lima", content: "Liberei o acesso." })]);
    expect(entry?.content).toBe("[Analista Rafael Lima] Liberei o acesso.");
  });
});
