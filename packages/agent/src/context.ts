import type { Draft, DraftPayload, Person, Transfer } from "@nexo/shared";
import type { TicketsClient } from "@nexo/tickets/client";

/** What the agent can do to the conversation it is running in. Implemented by the web app. */
export interface ConversationPort {
  saveDraft(payload: DraftPayload, dueAt: Date | null): Promise<Draft>;
  requestTransfer(transfer: Omit<Transfer, "at">): Promise<void>;
}

export interface AgentContext {
  user: Person;
  tickets: TicketsClient;
  conversation: ConversationPort;
  now?: () => Date;
}
