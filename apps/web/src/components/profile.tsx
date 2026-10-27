import type { Person } from "@nexo/shared";
import { KeyRound, Lock, Mail, RotateCcw } from "lucide-react";

export const profileCard =
  "w-full overflow-hidden rounded-2xl bg-white shadow-card outline outline-ink/[0.09] -outline-offset-[0.5px]";

export function AccountDetails({ user }: { user: Person }) {
  return (
    <>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-[-0.4px]">Meu perfil</h1>
            <p className="text-[14.5px] text-muted">Seus dados de acesso ao service desk de TI.</p>
          </div>

          <section className={profileCard}>
            <Row label="Nome">{user.name}</Row>
            <Row label="Área">{user.department}</Row>
            <Row
              label="E-mail corporativo"
              aside={
                <span className="flex items-center gap-[5px] text-[12.5px] text-muted">
                  <Lock className="size-3.5" /> Gerenciado pela TI
                </span>
              }
              last
            >
              {user.email}
            </Row>
          </section>

          <section className={profileCard}>
            <div className="flex items-center gap-4 p-6">
              <span className="grid size-10 place-items-center rounded-full bg-subtle">
                <KeyRound className="size-[18px] text-body" />
              </span>
              <div className="flex-1">
                <p className="text-[14.5px] font-semibold">Senha</p>
                <p className="text-[13.5px] text-muted">Alterada há 42 dias</p>
              </div>
              <span className="flex h-9 items-center gap-[7px] rounded-lg pr-3.5 pl-3 text-[13.5px] font-medium text-body hairline">
                <RotateCcw className="size-4" /> Redefinir senha
              </span>
            </div>
            <p className="flex items-center gap-2 border-t border-line bg-subtle px-6 py-3 text-[13px] text-muted">
              <Mail className="size-4" /> Enviaremos um link de redefinição para {user.email}.
            </p>
          </section>
    </>
  );
}

function Row({
  label,
  children,
  aside,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 px-6 py-5 ${last ? "" : "border-b border-line"}`}>
      <span className="w-40 text-[13.5px] text-muted">{label}</span>
      <span className="flex-1 text-[14.5px] font-medium">{children}</span>
      {aside}
    </div>
  );
}
