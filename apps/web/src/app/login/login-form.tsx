"use client";

import { ArrowRight, Check, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useActionState, useState } from "react";
import { type LoginState, login } from "./actions";

const DEMO_ACCOUNTS = [
  ["ana.souza@nexo.com.br", "Funcionária"],
  ["rafael.lima@nexo.com.br", "Analista"],
] as const;

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(state.email ?? "");

  return (
    <form action={action} className="flex w-[380px] max-w-full flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-[40px] leading-[44px] tracking-[-0.8px]">Entrar</h2>
        <p className="text-[15.5px] leading-[23px] text-muted">Use seu e-mail corporativo e a senha da rede Nexo.</p>
      </div>

      <div className="flex flex-col gap-[18px]">
        <label className="flex flex-col gap-2">
          <span className="text-[13.5px] font-medium">E-mail corporativo</span>
          <span className="flex h-11 items-center gap-2.5 rounded-lg bg-white pr-2 pl-3.5 shadow-control hairline focus-within:outline-[1.5px] focus-within:outline-primary">
            <Mail className="size-4 text-muted" />
            <input
              name="email"
              type="email"
              autoComplete="username"
              placeholder="nome.sobrenome@nexo.com.br"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-muted/70"
              required
            />
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex justify-between text-[13.5px] font-medium">
            Senha
            <span className="text-primary-text">Esqueci minha senha</span>
          </span>
          <span className="flex h-11 items-center gap-2.5 rounded-lg bg-white pr-2 pl-3.5 shadow-control hairline focus-within:outline-[1.5px] focus-within:outline-primary">
            <Lock className="size-4 text-muted" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="flex-1 bg-transparent text-[14.5px] outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="grid size-[30px] place-items-center rounded-md text-muted hover:bg-subtle"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>

        <label className="group flex w-fit items-center gap-[9px] pt-0.5 text-[13.5px] text-body">
          <input type="checkbox" name="remember" defaultChecked className="peer sr-only" />
          <span className="grid size-[18px] place-items-center rounded-md bg-white hairline peer-checked:bg-primary peer-checked:outline-primary peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
            <Check className="size-3 text-white" strokeWidth={3} />
          </span>
          Manter conectado neste computador
        </label>
      </div>

      {state.error && (
        <p role="alert" className="-my-2 rounded-lg bg-danger-soft px-3 py-2 text-[13.5px] text-danger-text">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-[15.5px] font-semibold text-white shadow-primary transition hover:bg-primary/90 disabled:opacity-70"
      >
        {pending ? "Entrando…" : "Entrar"}
        <ArrowRight className="size-4" />
      </button>

      <div className="flex flex-col gap-2 border-t border-line pt-4 text-[12.5px] text-muted">
        <span>Contas de demonstração (qualquer senha):</span>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map(([demoEmail, label]) => (
            <button
              key={demoEmail}
              type="button"
              onClick={() => setEmail(demoEmail)}
              className="rounded-md bg-subtle px-2 py-1 text-body hover:bg-accent-soft hover:text-primary-text"
            >
              {label}: {demoEmail}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
