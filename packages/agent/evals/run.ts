import { randomUUID } from "node:crypto";
import { type ChatMessage, type DraftPayload, PEOPLE, type Transfer } from "@nexo/shared";
import { createInMemoryTicketsClient } from "@nexo/tickets/testing";
import { defaultModel, runAgentTurn } from "../src";
import { type Scenario, type TurnOutcome, scenarios } from "./scenarios";

// US$ por milhão de tokens no tier pago; ajuste para o modelo em GEMINI_MODEL. Só para estimar o custo.
const PRICE_PER_MILLION = {
  input: Number(process.env.EVAL_PRICE_INPUT ?? 0.1),
  output: Number(process.env.EVAL_PRICE_OUTPUT ?? 0.4),
};

// O tier gratuito do Gemini permite poucas requisições por minuto; espaça os cenários.
const PAUSE_MS = Number(process.env.EVAL_PAUSE_MS ?? 8_000);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isRateLimit = (error: unknown) => /429|quota|RESOURCE_EXHAUSTED/i.test(String(error instanceof Error ? error.message : error));

const ana = PEOPLE.find((person) => person.id === "u-ana")!;
const filter = process.argv[2]?.toLowerCase();

const toMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({
  id: randomUUID(),
  conversationId: "eval",
  role,
  authorName: role === "agent" ? "Nexo Assist" : null,
  content,
  cards: [],
  trace: null,
  createdAt: new Date().toISOString(),
});

async function runScenario(scenario: Scenario) {
  const drafts: DraftPayload[] = [];
  const transfers: Array<Omit<Transfer, "at">> = [];
  const history = [...(scenario.history ?? []), ["user", scenario.message] as const].map(([role, content]) =>
    toMessage(role, content),
  );

  const turn = await runAgentTurn(
    {
      user: ana,
      tickets: await createInMemoryTicketsClient(),
      conversation: {
        async saveDraft(payload, dueAt) {
          drafts.push(payload);
          return {
            id: `D-${drafts.length}`,
            conversationId: "eval",
            status: "pending",
            payload,
            dueAt: dueAt?.toISOString() ?? null,
            ticketId: null,
            createdAt: new Date().toISOString(),
          };
        },
        async requestTransfer(transfer) {
          transfers.push(transfer);
        },
      },
    },
    { messages: history, drafts: {} },
  );

  const outcome: TurnOutcome = {
    text: turn.text,
    tools: [...new Set(turn.trace.steps.map((step) => step.tool))],
    drafts,
    transfers,
  };
  const failure = scenario.check(outcome) ?? (turn.trace.decision ? null : "não registrou a decisão (registerDecision)");
  return { outcome, failure, decision: turn.trace.decision, tokens: turn.trace.tokens ?? { input: 0, output: 0 } };
}

const selected = scenarios.filter((scenario) => !filter || scenario.name.toLowerCase().includes(filter));
let passed = 0;
const totals = { input: 0, output: 0 };

console.log(`Modelo: ${defaultModel()} · ${selected.length} cenários\n`);

async function runWithRetry(scenario: Scenario) {
  try {
    return await runScenario(scenario);
  } catch (error) {
    if (!isRateLimit(error)) throw error;
    await sleep(60_000);
    return runScenario(scenario);
  }
}

for (const [index, scenario] of selected.entries()) {
  if (index > 0) await sleep(PAUSE_MS);
  try {
    const { outcome, failure, decision, tokens } = await runWithRetry(scenario);
    totals.input += tokens.input;
    totals.output += tokens.output;
    if (!failure) passed++;
    console.log(`${failure ? "✗" : "✓"} ${scenario.name}`);
    console.log(`    ferramentas: ${outcome.tools.join(", ") || "nenhuma"}`);
    if (decision) console.log(`    decisão: ${decision.intent} · confiança ${Math.round(decision.confidence * 100)}%`);
    if (failure) console.log(`    falha: ${failure}\n    resposta: ${outcome.text.replace(/\s+/g, " ").slice(0, 240)}`);
  } catch (error) {
    console.log(`✗ ${scenario.name}\n    erro: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const cost = (totals.input * PRICE_PER_MILLION.input + totals.output * PRICE_PER_MILLION.output) / 1_000_000;
console.log(
  `\n${passed}/${selected.length} cenários passaram · ${totals.input} tokens de entrada, ${totals.output} de saída · ~US$ ${(cost / Math.max(selected.length, 1)).toFixed(4)} por turno`,
);
process.exitCode = passed === selected.length ? 0 : 1;
