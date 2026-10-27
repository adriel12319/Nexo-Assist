import { MESSAGE_LIMIT } from "@nexo/shared";
import { ChatView } from "@/components/chat/chat-view";
import { findActiveConversation, loadState } from "@/server/conversations";
import { requirePage } from "@/server/session";

export const metadata = { title: "Atendimento · Nexo Assist" };

export default async function AtendimentoPage() {
  const user = await requirePage("employee");
  const state = await loadState(await findActiveConversation(user.id));

  return (
    <ChatView
      initial={{
        status: state.conversation?.status ?? "agent",
        messagesLeft: MESSAGE_LIMIT - (state.conversation?.userMessageCount ?? 0),
        messages: state.messages,
        drafts: state.drafts,
      }}
    />
  );
}
