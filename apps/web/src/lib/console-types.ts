import type { ChatMessage, ConversationStatus, Draft, Person, Ticket, Transfer } from "@nexo/shared";

export interface ConversationListItem {
  id: string;
  status: ConversationStatus;
  employee: Person;
  assignedAnalyst: Person | null;
  transfer: Transfer | null;
  lastMessage: Pick<ChatMessage, "role" | "content" | "createdAt"> | null;
  updatedAt: string;
}

export interface ConversationDetail {
  conversation: {
    id: string;
    status: ConversationStatus;
    assignedAnalystId: string | null;
    transfer: Transfer | null;
  };
  messages: ChatMessage[];
  drafts: Record<string, Draft>;
  employee: Person;
  assignedAnalyst: Person | null;
  tickets: Ticket[] | null;
}
