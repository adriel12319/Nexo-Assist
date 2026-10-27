import { redirect } from "next/navigation";
import { Brand } from "@/components/nexo-mark";
import { currentUser, homeFor } from "@/server/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="flex min-h-screen">
      <Showcase />
      <section className="flex flex-1 flex-col justify-between px-6 py-10 sm:px-14">
        <p className="flex justify-end gap-1.5 text-[13.5px] text-muted">
          Problema para entrar? <span className="font-semibold text-primary-text">Ligue no ramal 4000</span>
        </p>
        <div className="flex justify-center py-10">
          <LoginForm />
        </div>
        <footer className="flex justify-between text-[12.5px] text-muted">
          <span>© 2026 Nexo · Service desk de TI</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </section>
    </main>
  );
}

function Showcase() {
  return (
    <aside className="hidden w-[min(800px,55vw)] shrink-0 flex-col overflow-hidden justify-between bg-ink px-16 pt-10 pb-12 lg:flex">
      <Brand className="text-white" />

      <div className="flex flex-col gap-9">
        <div className="flex flex-col gap-[18px]">
          <p className="text-[13.5px] font-medium text-white/55">Service desk de TI da Nexo</p>
          <h1 className="font-serif text-[54px] leading-[56px] tracking-[-1.2px] text-white">
            Seu problema de TI, resolvido em uma conversa.
          </h1>
          <p className="max-w-[520px] text-base leading-[25px] text-white/65">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um
            analista quando precisa.
          </p>
        </div>

        <div className="pl-24">
          <div className="flex w-[500px] max-w-full flex-col gap-2.5 rounded-2xl bg-white/[0.04] p-[18px] outline outline-white/[0.08]">
            <div className="flex justify-end">
              <p className="rounded-[12px_12px_4px_12px] bg-white px-3.5 py-[9px] text-[13.5px] text-ink">
                Meu notebook não conecta na VPN. Erro 809.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[12.5px] text-white/45">
                <span className="font-semibold text-white/80">Nexo Assist</span> · consultou seus chamados · criou um
                chamado
              </p>
              <p className="w-[380px] max-w-full rounded-[4px_12px_12px_12px] bg-white/[0.08] px-3.5 py-2.5 text-[13.5px] leading-5 text-white">
                Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.
              </p>
              <p className="flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-[7px] text-[12.5px]">
                <span className="size-[7px] rounded-full bg-warning" />
                <span className="font-semibold">INC-20517</span>
                <span className="text-muted">Rede e VPN · Alta · em até 4 h</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 border-t border-white/10 pt-6">
        {[
          ["8 s", "primeira resposta, em média"],
          ["72%", "resolvidos sem fila"],
          ["6", "analistas online agora"],
        ].map(([value, label], index) => (
          <div key={label} className={index > 0 ? "border-l border-white/10 pl-6" : ""}>
            <dt className="flex items-center gap-2 font-serif text-[34px] tracking-[-0.6px] text-white">
              {value}
              {index === 2 && <span className="size-2 rounded-full bg-success" />}
            </dt>
            <dd className="mt-1.5 text-[13.5px] text-white/55">{label}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
