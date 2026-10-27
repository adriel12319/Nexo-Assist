"use client";

import { MessagesSquare, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/atendimento", label: "Atendimento", icon: MessagesSquare },
  { href: "/perfil", label: "Meu perfil", icon: UserRound },
];

export function NavLinks({ labelClassName }: { labelClassName: string }) {
  const pathname = usePathname();
  return (
    <nav className="mt-[22px] flex flex-col gap-0.5">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] ${
              active ? "bg-accent-soft font-semibold text-primary-text" : "font-medium text-body hover:bg-subtle"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span className={labelClassName}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
