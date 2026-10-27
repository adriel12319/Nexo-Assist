import { ChevronRight } from "lucide-react";

export function TopBar({ here, children }: { here: string; children?: React.ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line px-8">
      <nav className="flex flex-1 items-center gap-2 text-[13.5px]">
        <span className="text-muted">Service desk de TI</span>
        <ChevronRight className="size-3.5 text-muted" />
        <span className="font-semibold">{here}</span>
      </nav>
      {children}
    </header>
  );
}

const PILL_TONES = {
  success: "bg-success-soft text-success-text [--dot:var(--color-success)]",
  warning: "bg-warning-soft text-warning-text [--dot:var(--color-warning)]",
  info: "bg-accent-soft text-primary-text [--dot:var(--color-accent)]",
};

export function StatusPill({ tone, children }: { tone: keyof typeof PILL_TONES; children: React.ReactNode }) {
  return (
    <span className={`flex items-center gap-[7px] rounded-full px-2.5 py-[5px] text-[12.5px] font-semibold ${PILL_TONES[tone]}`}>
      <span className="size-[7px] rounded-full bg-(--dot)" />
      {children}
    </span>
  );
}
