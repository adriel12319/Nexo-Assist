import { MESSAGE_LIMIT } from "@nexo/shared";
import { findActiveConversation, loadState } from "@/server/conversations";
import { handler } from "@/server/http";
import { requireApi } from "@/server/session";

export const GET = handler(async () => {
  const user = await requireApi("employee");
  const state = await loadState(await findActiveConversation(user.id));
  return Response.json({
    status: state.conversation?.status ?? "agent",
    messagesLeft: MESSAGE_LIMIT - (state.conversation?.userMessageCount ?? 0),
    messages: state.messages,
    drafts: state.drafts,
  });
});
