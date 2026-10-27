import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { type Person, type Role, findPerson } from "@nexo/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "nexo_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("SESSION_SECRET must be set (at least 16 characters)");
  return value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function verify(token: string): string | null {
  const [userId, expires, signature] = token.split(".");
  if (!userId || !expires || !signature) return null;
  if (Number(expires) < Date.now() / 1000) return null;

  const expected = Buffer.from(sign(`${userId}.${expires}`));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received) ? userId : null;
}

export async function startSession(userId: string, remember: boolean) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `${userId}.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? MAX_AGE_SECONDS : undefined,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<Person | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const userId = token ? verify(token) : null;
  return userId ? (findPerson(userId) ?? null) : null;
}

/** For pages: sends anonymous users to the login and other roles to their home. */
export async function requirePage(role: Role) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homeFor(user.role));
  return user;
}

export const homeFor = (role: Role) => (role === "analyst" ? "/console" : "/atendimento");

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** For route handlers: throws HttpError instead of redirecting. */
export async function requireApi(role: Role) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sessão expirada. Entre novamente.");
  if (user.role !== role) throw new HttpError(403, "Acesso negado.");
  return user;
}
