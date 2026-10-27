import { initials } from "@nexo/shared";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { NexoMark } from "@/components/nexo-mark";
import { requirePage } from "@/server/session";
import { logout } from "../login/actions";
import { NavLinks } from "./nav-links";

const label = "whitespace-nowrap opacity-0 transition-opacity group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage("employee");

  return (
    <div className="flex h-screen">
      {/* Reserva só a largura recolhida; a barra expandida passa por cima do conteúdo. */}
      <div className="relative hidden w-16 shrink-0 md:block">
        <aside className="group/sidebar absolute inset-y-0 left-0 z-20 flex w-16 flex-col overflow-hidden border-r border-line bg-white px-3 pt-5 pb-3.5 transition-[width,box-shadow] duration-200 hover:w-[232px] hover:shadow-[8px_0_24px_#1B243114] focus-within:w-[232px]">
          <div className="flex items-center gap-2.5 px-2">
            <span className="shrink-0">
              <NexoMark />
            </span>
            <span className={`text-base font-bold tracking-[-0.2px] ${label}`}>Nexo Assist</span>
          </div>

          <NavLinks labelClassName={label} />

          <Link
            href="/perfil"
            title="Meu perfil"
            className="mt-auto flex items-center gap-2.5 rounded-lg border-t border-line px-1 pt-3.5 pb-1 hover:bg-subtle"
          >
            <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-accent-soft text-[12.5px] font-bold text-primary-text">
              {initials(user.name)}
            </span>
            <span className={`min-w-0 ${label}`}>
              <span className="block text-[13.5px] font-semibold">{user.name}</span>
              <span className="block truncate text-[11.5px] text-muted">{user.email}</span>
            </span>
          </Link>
          <form action={logout}>
            <button
              title="Sair"
              className="flex h-[34px] w-full items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium text-body hover:bg-subtle"
            >
              <LogOut className="size-4 shrink-0" />
              <span className={label}>Sair</span>
            </button>
          </form>
        </aside>
      </div>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
