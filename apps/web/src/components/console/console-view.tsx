"use client";

import type { Person } from "@nexo/shared";
import { Bot, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ConversationDetail, ConversationListItem } from "@/lib/console-types";
import { formatListTime } from "@/lib/format";
import { Avatar } from "./avatar";
import { ConsoleRail } from "./console-rail";
import { ConversationPane } from "./conversation-pane";
import { EmployeePanel } from "./employee-panel";
import { conversationTag } from "./tags";

type Filter = "all" | "waiting" | "agent" | "mine";

const POLL_MS = 3000;

export function ConsoleView({ analyst, initial }: { analyst: Person; initial: ConversationListItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("waiting");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.find((item) => item.status === "waiting_analyst")?.id ?? initial[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [list, current] = await Promise.all([
      api<ConversationListItem[]>("/api/console/conversations"),
      selectedId ? api<ConversationDetail>(`/api/console/conversations/${selectedId}`) : Promise.resolve(null),
    ]);
    setItems(list);
    setDetail(current);
    setDetailError(null);
  }, [selectedId]);

  useEffect(() => {
    setDetail(null);
    refresh().catch((error: Error) => setDetailError(error.message));
    const timer = setInterval(() => refresh().catch(() => {}), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const counts = useMemo(
    () => ({
      all: items.length,
      waiting: items.filter((item) => item.status === "waiting_analyst").length,
      agent: items.filter((item) => item.status === "agent").length,
      mine: items.filter((item) => item.status === "with_analyst" && item.assignedAnalyst?.id === analyst.id).length,
    }),
    [items, analyst.id],
  );

  const visible = items.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "waiting" && item.status === "waiting_analyst") ||
      (filter === "agent" && item.status === "agent") ||
      (filter === "mine" && item.status === "with_analyst" && item.assignedAnalyst?.id === analyst.id);
    const text = `${item.employee.name} ${item.transfer?.ticketId ?? ""} ${item.lastMessage?.content ?? ""}`.toLowerCase();
    return matchesFilter && text.includes(query.trim().toLowerCase());
  });

  return (
    <div className="flex h-screen bg-white">
      <ConsoleRail analyst={analyst} active="conversations" waiting={counts.waiting} />

      <section className="flex w-[380px] shrink-0 flex-col border-r border-line">
        <header className="flex flex-col gap-3 px-4 pt-4 pb-2.5">
          <div className="flex items-center gap-2">
            <h1 className="flex-1 text-xl font-bold tracking-[-0.3px]">Conversas</h1>
            <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-[5px] text-[12.5px] font-semibold text-success-text">
              <span className="size-[7px] rounded-full bg-success" /> Disponível
            </span>
          </div>
          <label className="flex h-9 items-center gap-2.5 rounded-full bg-subtle px-3">
            <Search className="size-4 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar conversa ou chamado"
              className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted"
            />
          </label>
          <div className="flex gap-1">
            {(
              [
                ["all", "Todas", null],
                ["waiting", "Para você", counts.waiting],
                ["agent", "Com o agent", counts.agent],
                ["mine", "Minhas", counts.mine],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 rounded-full px-[9px] py-1.5 text-[12.5px] font-medium ${
                  filter === key ? "bg-accent-soft text-primary-text" : "bg-subtle text-body hover:bg-line"
                }`}
              >
                {label}
                {count !== null && <span className="font-semibold">{count}</span>}
              </button>
            ))}
          </div>
        </header>

        <ul className="flex-1 overflow-y-auto px-2">
          {visible.length === 0 && <li className="px-3 py-8 text-center text-[13.5px] text-muted">Nenhuma conversa aqui.</li>}
          {visible.map((item) => {
            const tag = conversationTag(item, analyst.id);
            const selected = item.id === selectedId;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setSelectedId(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ${selected ? "bg-subtle" : "hover:bg-subtle/60"}`}
                >
                  <Avatar id={item.employee.id} name={item.employee.name} />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px] border-b border-line pb-2.5">
                    <span className="flex items-center gap-2">
                      <span className={`flex-1 truncate text-[15.5px] ${item.status === "waiting_analyst" ? "font-semibold" : "font-medium"}`}>
                        {item.employee.name}
                      </span>
                      <span className={`text-[12.5px] ${item.status === "waiting_analyst" ? "font-semibold text-primary" : "text-muted"}`}>
                        {formatListTime(item.updatedAt)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[13.5px] text-muted">
                      {item.lastMessage?.role === "agent" && <Bot className="size-3.5 shrink-0" />}
                      <span className="truncate">
                        {item.lastMessage?.role === "agent" && "Nexo: "}
                        {item.lastMessage?.content ?? "Sem mensagens"}
                      </span>
                    </span>
                    <span className={`flex items-center gap-[5px] text-[11.5px] font-medium ${tag.text}`}>
                      <span className={`size-1.5 rounded-full ${tag.dot}`} />
                      {tag.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {selectedId && detail ? (
        <>
          <ConversationPane key={detail.conversation.id} detail={detail} analyst={analyst} onChange={refresh} />
          <EmployeePanel detail={detail} />
        </>
      ) : (
        <div className="grid flex-1 place-items-center bg-canvas text-[13.5px] text-muted">
          {detailError ?? (selectedId ? "Carregando conversa…" : "Selecione uma conversa")}
        </div>
      )}
    </div>
  );
}
