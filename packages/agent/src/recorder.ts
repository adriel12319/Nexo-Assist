import type { Card, Decision, TraceStep } from "@nexo/shared";
import { TicketsServiceError } from "@nexo/tickets/client";

export type TurnEvent = { type: "step"; step: TraceStep } | { type: "card"; card: Card } | { type: "text"; delta: string };

export type StepFn = (label: string, detail?: string) => void;

/** Collects what the agent did during a turn so the UI can show it next to the answer. */
export class TurnRecorder {
  readonly steps: TraceStep[] = [];
  readonly cards: Card[] = [];
  decision: Decision | undefined;

  constructor(private readonly emit: (event: TurnEvent) => void = () => {}) {}

  card(card: Card) {
    this.cards.push(card);
    this.emit({ type: "card", card });
  }

  text(delta: string) {
    this.emit({ type: "text", delta });
  }

  /** Runs a tool body, recording its steps and turning service outages into a result the model can explain. */
  async run<T>(tool: string, body: (step: StepFn) => Promise<T>): Promise<T | { error: string }> {
    const startedAt = Date.now();
    const step: StepFn = (label, detail) => this.push({ tool, label, detail, ok: true, durationMs: Date.now() - startedAt });

    try {
      return await body(step);
    } catch (error) {
      if (error instanceof TicketsServiceError && error.status === 404) {
        this.push({ tool, label: "não encontrou o chamado", ok: false, durationMs: Date.now() - startedAt });
        return { error: "Chamado não encontrado entre os chamados deste funcionário." };
      }
      if (error instanceof TicketsServiceError && error.unavailable) {
        this.push({ tool, label: "sistema de chamados indisponível", ok: false, durationMs: Date.now() - startedAt });
        return { error: "O sistema de chamados está fora do ar no momento. Peça para o funcionário tentar de novo em instantes." };
      }
      this.push({ tool, label: "falhou", detail: String(error), ok: false, durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  private push(step: TraceStep) {
    this.steps.push(step);
    this.emit({ type: "step", step });
  }
}
