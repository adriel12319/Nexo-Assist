"use server";

import { findPersonByEmail } from "@nexo/shared";
import { redirect } from "next/navigation";
import { endSession, homeFor, startSession } from "@/server/session";

export interface LoginState {
  error?: string;
  email?: string;
}

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || !password) return { error: "Informe o e-mail e a senha.", email };
  if (!email.toLowerCase().endsWith("@nexo.com.br")) return { error: "Use seu e-mail corporativo @nexo.com.br.", email };

  // Ambiente de demonstração: qualquer senha é aceita para os usuários cadastrados.
  const person = findPersonByEmail(email);
  if (!person) return { error: "E-mail não encontrado na rede Nexo.", email };

  await startSession(person.id, form.get("remember") === "on");
  redirect(homeFor(person.role));
}

export async function logout() {
  await endSession();
  redirect("/login");
}
