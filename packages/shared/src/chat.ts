import type { Impact, NewTicket, Priority, Ticket, TicketStatus } from "./domain";

export type DraftStatus = "pending" | "confirmed" | "cancelled" | "failed";

export type DraftPayload =
  | { kind: "create"; ticket: NewTicket; priorityReason: string }
  | { kind: "update" | "reopen"; ticketId: string; ticketTitle: string; message: string } & PriorityChange;

/** Set only when new information makes the ticket more severe; priority never goes down. */
interface PriorityChange {
  priority?: Priority;
  impact?: Impact;
  priorityReason?: string;
}

export interface Draft {
  id: string;
  conversationId: string;
  status: DraftStatus;
  payload: DraftPayload;
  dueAt: string | null;
  ticketId: string | null;
  createdAt: string;
}

export interface TicketSummary {
  id: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  category: Ticket["category"];
  updatedAt: string;
  overdue: boolean;
}

export type Card =
  | { kind: "ticket"; ticket: Ticket }
  | { kind: "ticket-picker"; tickets: TicketSummary[] }
  | { kind: "draft"; draftId: string }
  | { kind: "options"; question?: string; options: string[] };

export interface TraceStep {
  tool: string;
  label: string;
  detail?: string;
  ok: boolean;
  durationMs: number;
}

export interface Decision {
  intent: string;
  confidence: number;
  rationale: string;
}

export interface MessageTrace {
  steps: TraceStep[];
  decision?: Decision;
  model?: string;
  tokens?: { input: number; output: number };
}

export type MessageRole = "user" | "agent" | "analyst" | "system";

export type ConversationStatus = "agent" | "waiting_analyst" | "with_analyst" | "closed";

export type TransferReason = "pedido_do_funcionario" | "critico" | "chamado_vencido" | "baixa_confianca";

export const TRANSFER_REASON_LABEL: Record<TransferReason, string> = {
  pedido_do_funcionario: "Funcionário pediu um analista",
  critico: "Caso crítico",
  chamado_vencido: "Chamado com prazo vencido",
  baixa_confianca: "Agent pediu ajuda",
};

export interface Transfer {
  reason: TransferReason;
  summary: string;
  confidence: number | null;
  ticketId: string | null;
  at: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  authorName: string | null;
  content: string;
  cards: Card[];
  trace: MessageTrace | null;
  createdAt: string;
}

export const MESSAGE_LIMIT = 30;
