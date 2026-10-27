import { z } from "zod";

export const CATEGORIES = ["Acesso", "Rede e VPN", "Hardware", "Software", "E-mail", "Outros"] as const;
export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const ticketTypeSchema = z.enum(["INC", "REQ"]);
export type TicketType = z.infer<typeof ticketTypeSchema>;

export const PRIORITIES = ["critica", "alta", "media", "baixa"] as const;
export const prioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof prioritySchema>;

export const impactSchema = z.enum(["individual", "equipe", "empresa"]);
export type Impact = z.infer<typeof impactSchema>;

export const TICKET_STATUSES = [
  "aberto",
  "em_andamento",
  "aguardando_analista",
  "aprovado",
  "resolvido",
  "fechado",
] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const CLOSED_STATUSES: readonly TicketStatus[] = ["resolvido", "fechado"];
export const isOpenStatus = (status: TicketStatus) => !CLOSED_STATUSES.includes(status);

export const REOPEN_WINDOW_DAYS = 7;

export const PRIORITY_LABEL: Record<Priority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_analista: "Aguardando analista",
  aprovado: "Aprovado",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const IMPACT_LABEL: Record<Impact, string> = {
  individual: "Somente você",
  equipe: "Sua equipe",
  empresa: "Toda a empresa",
};

export const ticketEventSchema = z.object({
  at: z.string(),
  author: z.string(),
  message: z.string(),
});
export type TicketEvent = z.infer<typeof ticketEventSchema>;

export const ticketSchema = z.object({
  id: z.string(),
  type: ticketTypeSchema,
  title: z.string(),
  description: z.string(),
  category: categorySchema,
  priority: prioritySchema,
  impact: impactSchema,
  status: ticketStatusSchema,
  requesterId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  dueAt: z.string().nullable(),
  overdue: z.boolean(),
  events: z.array(ticketEventSchema),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const newTicketSchema = z.object({
  type: ticketTypeSchema,
  title: z.string().min(5).max(120),
  description: z.string().min(10).max(2000),
  category: categorySchema,
  priority: prioritySchema,
  impact: impactSchema,
});
export type NewTicket = z.infer<typeof newTicketSchema>;

export const ticketUpdateSchema = z.object({
  message: z.string().min(3).max(2000),
  priority: prioritySchema.optional(),
  impact: impactSchema.optional(),
  reopen: z.boolean().optional(),
});
export type TicketUpdate = z.infer<typeof ticketUpdateSchema>;

export const articleSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  category: categorySchema,
  tags: z.array(z.string()),
});
export type Article = z.infer<typeof articleSchema>;
