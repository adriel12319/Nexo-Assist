import { type Person, initials } from "@nexo/shared";
import { LogOut, MessagesSquare, UserRound } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { NexoMark } from "@/components/nexo-mark";

const label = "whitespace-nowrap opacity-0 transition-opacity group-hover/rail:opacity-100 group-focus-within/rail:opacity-100";

const item = (active: boolean) =>
  `relative flex h-10 items-center gap-3 rounded-xl px-[11px] text-[13.5px] ${
    active ? "bg-white font-semibold text-ink drop-shadow-[0_1px_1px_#1B24311A]" : "font-medium text-body hover:bg-white"
  }`;

export function ConsoleRail({
  analyst,
  active,
  waiting = 0,
}: {
  analyst: Person;
  active: "conversations" | "profile";
  waiting?: number;
}) {
  return (
    // Reserva só a largura recolhida; a barra expandida passa por cima das colunas.
    <div className="relative w-16 shrink-0">
      <nav className="group/rail absolute inset-y-0 left-0 z-20 flex w-16 flex-col gap-1.5 overflow-hidden border-r border-line bg-subtle px-3 py-4 transition-[width,box-shadow] duration-200 hover:w-[232px] hover:shadow-[8px_0_24px_#1B243114] focus-within:w-[232px]">
        <span className="flex h-10 items-center gap-3 px-[9px] pb-2">
          <span className="shrink-0">
            <NexoMark size={22} />
          </span>
          <span className={`text-base font-bold tracking-[-0.2px] ${label}`}>Nexo Assist</span>
        </span>

        <Link href="/console" title="Conversas" className={item(active === "conversations")}>
          <MessagesSquare className="size-[18px] shrink-0" />
          {waiting > 0 && (
            <span className="absolute top-1 left-6 flex h-4 items-center rounded-full bg-primary px-[5px] text-[10px] font-bold text-white outline-2 outline-subtle">
              {waiting}
            </span>
          )}
          <span className={label}>Conversas</span>
        </Link>
        <Link href="/console/perfil" title="Meu perfil" className={item(active === "profile")}>
          <UserRound className="size-[18px] shrink-0" />
          <span className={label}>Meu perfil</span>
        </Link>

        <form action={logout} className="mt-auto">
          <button title="Sair" className={`w-full ${item(false)}`}>
            <LogOut className="size-[18px] shrink-0" />
            <span className={label}>Sair</span>
          </button>
        </form>
        <Link href="/console/perfil" title={`${analyst.name} · ${analyst.department}`} className="flex items-center gap-3 rounded-xl px-0.5 py-1 hover:bg-white">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[12.5px] font-bold text-primary-text">
            {initials(analyst.name)}
            <span className="absolute top-[26px] left-[26px] size-2.5 rounded-full bg-success outline-2 outline-subtle" />
          </span>
          <span className={`min-w-0 ${label}`}>
            <span className="block text-[13.5px] font-semibold">{analyst.name}</span>
            <span className="block text-[11.5px] text-muted">{analyst.department}</span>
          </span>
        </Link>
      </nav>
    </div>
  );
}
