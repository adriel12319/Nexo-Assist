"use client";

import type { MessageTrace, TraceStep } from "@nexo/shared";
import { AlertTriangle, Check, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";

/** The "what did the agent do" line above each answer; expands into the full trace. */
export function AgentTrace({
  trace,
  running = false,
  showName = true,
}: {
  trace: MessageTrace | null;
  running?: boolean;
  showName?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const steps = trace?.steps ?? [];
  const decision = trace?.decision;
  const hasDetails = steps.some((step) => step.detail) || trace?.tokens || decision;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        {showName && <span className="font-semibold">Nexo Assist</span>}
        {steps.map((step, index) => (
          <StepChip key={index} step={step} />
        ))}
        {decision && <ConfidenceChip confidence={decision.confidence} />}
        {running && (
          <span className="flex items-center gap-[5px] text-muted">
            <Loader2 className="size-3.5 animate-spin" /> {steps.length ? "pensando" : "lendo sua mensagem"}
          </span>
        )}
        {!running && hasDetails && (
          <button
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex items-center gap-0.5 text-primary-text hover:underline"
          >
            {open ? "ocultar" : "por quê?"}
            <ChevronDown className={`size-3.5 transition ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {open && trace && (
        <ol className="flex flex-col gap-2 rounded-xl bg-subtle px-4 py-3 text-left text-[12.5px]">
          {decision && (
            <li className="border-b border-line pb-2">
              <p className="font-medium">
                Entendeu: {decision.intent}
                <span className="ml-2 font-normal text-muted">confiança {Math.round(decision.confidence * 100)}%</span>
              </p>
              <p className="mt-0.5 text-body">{decision.rationale}</p>
            </li>
          )}
          {steps.map((step, index) => (
            <li key={index} className="flex gap-2.5">
              <span className="w-4 shrink-0 pt-px text-right text-muted tabular-nums">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {step.label}
                  <span className="ml-2 font-normal text-muted">
                    {step.tool} · {step.durationMs} ms
                  </span>
                </p>
                {step.detail && <p className="mt-0.5 whitespace-pre-line text-body">{step.detail}</p>}
              </div>
            </li>
          ))}
          {trace.model && (
            <li className="border-t border-line pt-2 text-muted">
              Modelo {trace.model}
              {trace.tokens && ` · ${trace.tokens.input.toLocaleString("pt-BR")} tokens de entrada, ${trace.tokens.output.toLocaleString("pt-BR")} de saída`}
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

function ConfidenceChip({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const tone = confidence < 0.6 ? "bg-warning-soft text-warning-text" : "bg-subtle text-muted";
  return <span className={`rounded-md px-1.5 py-px font-medium ${tone}`}>confiança {percent}%</span>;
}

function StepChip({ step }: { step: TraceStep }) {
  return (
    <span className={`flex items-center gap-[5px] ${step.ok ? "text-muted" : "text-danger-text"}`}>
      {step.ok ? <Check className="size-3.5 text-success" /> : <AlertTriangle className="size-3.5" />}
      {step.label}
    </span>
  );
}
