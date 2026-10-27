import { createTool } from "@mastra/core/tools";
import {
  CATEGORIES,
  IMPACT_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  SLA,
  STATUS_LABEL,
  type Ticket,
  type TicketSummary,
  categorySchema,
  classifyPriority,
  dueDate,
  impactSchema,
  isOpenStatus,
  ticketTypeSchema,
} from "@nexo/shared";
import { z } from "zod";
import type { AgentContext } from "./context";
import { daysSince, formatDateTime } from "./format";
import type { TurnRecorder } from "./recorder";

const ticketIdSchema = z
  .string()
  .regex(/^(INC|REQ)-\d+$/i, "Use o número do chamado, ex.: INC-20311")
  .transform((id) => id.toUpperCase());

const summarize = (ticket: Ticket): TicketSummary => ({
  id: ticket.id,
  title: ticket.title,
  status: ticket.status,
  priority: ticket.priority,
  category: ticket.category,
  updatedAt: ticket.updatedAt,
  overdue: ticket.overdue,
});

export function createTools(ctx: AgentContext, rec: TurnRecorder) {
  const now = () => ctx.now?.() ?? new Date();
  const userId = ctx.user.id;

  const describeForModel = (ticket: Ticket) => ({
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    type: ticket.type,
    category: ticket.category,
    priority: PRIORITY_LABEL[ticket.priority],
    status: STATUS_LABEL[ticket.status],
    open: isOpenStatus(ticket.status),
    openedAt: formatDateTime(ticket.createdAt),
    lastUpdate: `${formatDateTime(ticket.updatedAt)} (há ${daysSince(ticket.updatedAt, now())} dias)`,
    sla: SLA[ticket.priority].label,
    dueAt: ticket.dueAt ? formatDateTime(ticket.dueAt) : null,
    overdue: ticket.overdue,
    lastEvents: ticket.events.slice(-3).map((event) => `${formatDateTime(event.at)} · ${event.message}`),
  });

  const searchHelpCenter = createTool({
    id: "searchHelpCenter",
    description:
      "Busca artigos na central de ajuda de TI. Use antes de abrir chamado para dúvidas e problemas comuns.",
    inputSchema: z.object({ query: z.string().describe("Palavras-chave do problema, ex.: 'vpn erro 809'") }),
    execute: ({ query }) =>
      rec.run("searchHelpCenter", async (step) => {
        const articles = await ctx.tickets.searchArticles(query);
        step(
          "buscou na central de ajuda",
          articles.length ? articles.map((a) => `${a.id} ${a.title} (relevância ${a.score})`).join("\n") : "Nenhum artigo relevante",
        );
        return { articles: articles.map(({ id, title, body }) => ({ id, title, body })) };
      }),
  });

  const listMyTickets = createTool({
    id: "listMyTickets",
    description:
      "Lista os chamados do funcionário. Use quando ele perguntar pelos chamados sem dizer o número, ou para checar se o problema já tem chamado.",
    inputSchema: z.object({
      onlyOpen: z.boolean().default(true),
      askToPick: z
        .boolean()
        .default(false)
        .describe("true para mostrar um seletor quando o funcionário precisa escolher um dos chamados"),
    }),
    execute: ({ onlyOpen, askToPick }) =>
      rec.run("listMyTickets", async (step) => {
        const all = await ctx.tickets.list(userId);
        const tickets = onlyOpen ? all.filter((ticket) => isOpenStatus(ticket.status)) : all;
        step("consultou seus chamados", `${tickets.length} ${onlyOpen ? "abertos" : "no total"}`);
        if (askToPick && tickets.length > 1) rec.card({ kind: "ticket-picker", tickets: tickets.map(summarize) });
        return {
          tickets: tickets.map((ticket) => ({
            id: ticket.id,
            title: ticket.title,
            status: STATUS_LABEL[ticket.status],
            category: ticket.category,
            overdue: ticket.overdue,
          })),
          pickerShown: askToPick && tickets.length > 1,
        };
      }),
  });

  const getTicket = createTool({
    id: "getTicket",
    description: "Consulta um chamado do funcionário pelo número, com status, prazo e histórico recente.",
    inputSchema: z.object({ ticketId: ticketIdSchema }),
    execute: ({ ticketId }) =>
      rec.run("getTicket", async (step) => {
        const ticket = await ctx.tickets.get(userId, ticketId);
        step(`consultou o ${ticket.id}`, `${STATUS_LABEL[ticket.status]} · prioridade ${PRIORITY_LABEL[ticket.priority]}`);
        if (isOpenStatus(ticket.status)) {
          step(
            "calculou o prazo",
            ticket.overdue
              ? `Vencido: sem atualização desde ${formatDateTime(ticket.updatedAt)}, prazo de ${SLA[ticket.priority].label}`
              : `Dentro do prazo, próxima atualização até ${ticket.dueAt ? formatDateTime(ticket.dueAt) : "-"}`,
          );
        }
        rec.card({ kind: "ticket", ticket });
        return { ticket: describeForModel(ticket), cardShown: true };
      }),
  });

  const draftNewTicket = createTool({
    id: "draftNewTicket",
    description:
      "Monta o rascunho de um chamado novo para o funcionário confirmar. Calcula prioridade e prazo e bloqueia duplicidade. Só chame quando souber o problema, quem é afetado e se impede o trabalho.",
    inputSchema: z.object({
      type: ticketTypeSchema.describe("INC quando algo parou ou não funciona; REQ para pedido de acesso, equipamento ou software"),
      category: categorySchema.describe(`Uma de: ${CATEGORIES.join(", ")}`),
      title: z.string().min(5).max(90).describe("Título curto e específico"),
      description: z
        .string()
        .min(20)
        .describe("Descrição completa para o analista: sintoma, desde quando, o que já foi tentado, equipamento/sistema"),
      impact: impactSchema.describe("individual = só a pessoa; equipe; empresa"),
      blocksWork: z.boolean().describe("O problema impede de trabalhar (sem alternativa)?"),
      deadlineToday: z.boolean().describe("Há compromisso hoje que depende disso?"),
      notSameAs: z
        .array(ticketIdSchema)
        .default([])
        .describe("Chamados parecidos que o funcionário confirmou serem outro problema"),
    }),
    execute: (input) =>
      rec.run("draftNewTicket", async (step) => {
        const similar = await ctx.tickets.findSimilar(userId, input.category, `${input.title} ${input.description}`);
        const match = similar.find(({ ticket }) => !input.notSameAs.includes(ticket.id));
        if (match) {
          step("encontrou um chamado parecido", `${match.ticket.id} · ${match.ticket.title} (similaridade ${match.score.toFixed(2)})`);
          return {
            duplicate: true,
            existing: describeForModel(match.ticket),
            canReopen: match.canReopen,
            instruction: `${
              match.canReopen
                ? "Há um chamado resolvido há menos de 7 dias parecido. Ofereça reabrir (draftTicketUpdate com reopen=true)."
                : "Há um chamado aberto parecido. Não crie outro: ofereça registrar a informação nele (draftTicketUpdate)."
            } Se o funcionário disser que é outro problema, chame draftNewTicket de novo com notSameAs=["${match.ticket.id}"].`,
          };
        }

        const decision = classifyPriority(input);
        const due = dueDate(decision.priority, now());
        step("classificou a prioridade", `${PRIORITY_LABEL[decision.priority]}: ${decision.reason}`);
        step("consultou o SLA", `${SLA[decision.priority].label} · resposta até ${formatDateTime(due)}`);

        const draft = await ctx.conversation.saveDraft(
          {
            kind: "create",
            ticket: {
              type: input.type,
              title: input.title,
              description: input.description,
              category: input.category,
              impact: input.impact,
              priority: decision.priority,
            },
            priorityReason: decision.reason,
          },
          due,
        );
        step("montou o rascunho", `Rascunho ${draft.id}`);
        rec.card({ kind: "draft", draftId: draft.id });

        return {
          duplicate: false,
          draftId: draft.id,
          priority: PRIORITY_LABEL[decision.priority],
          priorityReason: decision.reason,
          responseDue: formatDateTime(due),
          affected: IMPACT_LABEL[input.impact],
          cardShown: true,
          instruction: "O rascunho já aparece para o funcionário com botões Confirmar/Editar/Cancelar. Não diga que o chamado foi criado.",
        };
      }),
  });

  const draftTicketUpdate = createTool({
    id: "draftTicketUpdate",
    description:
      "Monta o rascunho de uma atualização (nova informação) ou reabertura de um chamado existente, para o funcionário confirmar.",
    inputSchema: z.object({
      ticketId: ticketIdSchema,
      message: z.string().min(5).describe("O que será registrado no chamado, escrito para o analista"),
      reopen: z.boolean().default(false).describe("true para reabrir um chamado resolvido há até 7 dias"),
      raisePriority: z
        .object({ impact: impactSchema, blocksWork: z.boolean(), deadlineToday: z.boolean() })
        .optional()
        .describe("Informe só se a nova informação muda a gravidade"),
    }),
    execute: ({ ticketId, message, reopen, raisePriority }) =>
      rec.run("draftTicketUpdate", async (step) => {
        const ticket = await ctx.tickets.get(userId, ticketId);
        step(`consultou o ${ticket.id}`, STATUS_LABEL[ticket.status]);

        if (!reopen && !isOpenStatus(ticket.status)) {
          return { error: `O ${ticket.id} já está ${STATUS_LABEL[ticket.status].toLowerCase()}. Ofereça reabrir se tiver até 7 dias, ou um chamado novo.` };
        }

        const decision = raisePriority ? classifyPriority({ type: ticket.type, ...raisePriority }) : null;
        const raised = decision && rank(decision.priority) < rank(ticket.priority) ? decision : null;
        if (decision) {
          step("reavaliou a prioridade", `${PRIORITY_LABEL[raised?.priority ?? ticket.priority]}: ${decision.reason}`);
        }
        const priority = raised?.priority ?? ticket.priority;
        const due = dueDate(priority, now());

        const draft = await ctx.conversation.saveDraft(
          {
            kind: reopen ? "reopen" : "update",
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            message,
            ...(raised && { priority: raised.priority, impact: raisePriority?.impact, priorityReason: raised.reason }),
          },
          due,
        );
        step(reopen ? "montou a reabertura" : "montou a atualização", `Rascunho ${draft.id}`);
        rec.card({ kind: "draft", draftId: draft.id });
        return {
          draftId: draft.id,
          priority: PRIORITY_LABEL[priority],
          responseDue: formatDateTime(due),
          cardShown: true,
          ...(priority === "critica" && { instruction: "É crítico: ao confirmar, um analista assume a conversa na hora. Avise o funcionário." }),
        };
      }),
  });

  const offerOptions = createTool({
    id: "offerOptions",
    description:
      "Mostra botões de resposta rápida para uma pergunta fechada (ex.: quem é afetado, se quer falar com analista). O texto da pergunta deve estar na sua resposta.",
    inputSchema: z.object({ options: z.array(z.string().min(1).max(40)).min(2).max(4) }),
    execute: async ({ options }) => {
      rec.card({ kind: "options", options });
      return { shown: true };
    },
  });

  const transferToAnalyst = createTool({
    id: "transferToAnalyst",
    description:
      "Transfere a conversa para um analista humano. Use quando o funcionário pedir, em casos críticos, em chamados vencidos que ele quer escalar, ou quando você não tiver segurança sobre o que fazer.",
    inputSchema: z.object({
      reason: z.enum(["pedido_do_funcionario", "critico", "chamado_vencido", "baixa_confianca"]),
      summary: z
        .string()
        .min(30)
        .describe("Resumo para o analista: problema, o que já foi verificado, chamados envolvidos e o que o funcionário espera"),
      confidence: z.number().min(0).max(1).describe("Sua confiança de que conseguiria resolver sozinho (0 a 1)"),
      ticketId: ticketIdSchema.optional(),
    }),
    execute: ({ reason, summary, confidence, ticketId }) =>
      rec.run("transferToAnalyst", async (step) => {
        await ctx.conversation.requestTransfer({ reason, summary, confidence, ticketId: ticketId ?? null });
        step("transferiu para um analista", summary);
        return {
          transferred: true,
          instruction: "Avise que um analista vai assumir a conversa e que você fica pausado até lá.",
        };
      }),
  });

  const registerDecision = createTool({
    id: "registerDecision",
    description:
      "Registra, para auditoria, o que você entendeu e quão seguro está. Chame uma vez por resposta, junto com a primeira ferramenta.",
    inputSchema: z.object({
      intent: z.string().max(80).describe("O que o funcionário quer, em poucas palavras"),
      confidence: z.number().min(0).max(1).describe("Sua confiança de que a ação escolhida é a certa (0 a 1)"),
      rationale: z.string().max(240).describe("Por que escolheu essa ação, citando a regra do service desk quando houver"),
    }),
    execute: async (decision) => {
      rec.decision = decision;
      return { registered: true };
    },
  });

  return { registerDecision, searchHelpCenter, listMyTickets, getTicket, draftNewTicket, draftTicketUpdate, offerOptions, transferToAnalyst };
}

const rank = (priority: Ticket["priority"]) => PRIORITIES.indexOf(priority);
