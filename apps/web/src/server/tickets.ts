import "server-only";
import { createTicketsClient } from "@nexo/tickets/client";

function serviceToken() {
  const token = process.env.TICKETS_SERVICE_TOKEN;
  if (token) return token;
  if (process.env.NODE_ENV === "production") throw new Error("TICKETS_SERVICE_TOKEN must be set in production");
  return "dev-token";
}

// Na Vercel, TICKETS_SERVICE_URL vem do binding do serviço privado (vercel.json).
export const tickets = createTicketsClient({
  baseUrl: process.env.TICKETS_SERVICE_URL ?? "http://localhost:4001",
  token: serviceToken,
});
