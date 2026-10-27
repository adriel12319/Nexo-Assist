import { TRANSFER_REASON_LABEL } from "@nexo/shared";
import type { ConversationListItem } from "@/lib/console-types";

interface Tag {
  label: string;
  dot: string;
  text: string;
}

export function conversationTag(item: Pick<ConversationListItem, "status" | "transfer" | "assignedAnalyst">, analystId: string): Tag {
  const { status, transfer, assignedAnalyst } = item;

  if (status === "waiting_analyst" && transfer?.reason === "baixa_confianca") {
    const confidence = transfer.confidence === null ? "" : ` · confiança ${Math.round(transfer.confidence * 100)}%`;
    return { label: `Agent pediu ajuda${confidence}`, dot: "bg-warning", text: "text-warning-text" };
  }
  if (status === "waiting_analyst") {
    const detail = transfer?.ticketId ?? (transfer ? TRANSFER_REASON_LABEL[transfer.reason] : "");
    return { label: `Transferida${detail ? ` · ${detail}` : ""}`, dot: "bg-danger", text: "text-danger-text" };
  }
  if (status === "with_analyst") {
    const who = assignedAnalyst?.id === analystId ? "você" : (assignedAnalyst?.name ?? "analista");
    return { label: `Em atendimento com ${who}`, dot: "bg-accent", text: "text-primary-text" };
  }
  if (status === "agent") return { label: "Agent atendendo", dot: "bg-success", text: "text-muted" };
  return { label: "Encerrada", dot: "bg-ink/30", text: "text-muted" };
}
