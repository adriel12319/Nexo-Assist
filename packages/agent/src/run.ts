import { Agent } from "@mastra/core/agent";
import type { Card, ChatMessage, Draft, MessageTrace } from "@nexo/shared";
import type { AgentContext } from "./context";
import { toModelMessages } from "./history";
import { buildInstructions } from "./instructions";
import { TurnRecorder, type TurnEvent } from "./recorder";
import { createTools } from "./tools";

const MAX_STEPS = 6;

export const defaultModel = () => process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

export interface TurnResult {
  text: string;
  cards: Card[];
  trace: MessageTrace;
}

export async function runAgentTurn(
  ctx: AgentContext,
  conversation: { messages: ChatMessage[]; drafts: Record<string, Draft> },
  onEvent?: (event: TurnEvent) => void,
): Promise<TurnResult> {
  const model = defaultModel();
  const recorder = new TurnRecorder(onEvent);
  const agent = new Agent({
    id: "nexo-assist",
    name: "Nexo Assist",
    instructions: buildInstructions(ctx.user, ctx.now?.() ?? new Date()),
    model: `google/${model}`,
    tools: createTools(ctx, recorder),
  });

  const stream = await agent.stream(toModelMessages(conversation.messages, conversation.drafts), {
    maxSteps: MAX_STEPS,
    modelSettings: { temperature: 0.2, maxRetries: 2 },
  });

  let text = "";
  for await (const chunk of stream.fullStream) {
    if (chunk.type === "text-delta") {
      text += chunk.payload.text;
      recorder.text(chunk.payload.text);
    } else if (chunk.type === "error") {
      throw chunk.payload.error instanceof Error ? chunk.payload.error : new Error(String(chunk.payload.error));
    }
  }

  if (stream.error) throw stream.error;
  const usage = await stream.usage;
  return {
    text: text.trim(),
    cards: recorder.cards,
    trace: {
      steps: recorder.steps,
      decision: recorder.decision,
      model,
      tokens: { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 },
    },
  };
}
