import type { Impact, Priority, TicketType } from "./domain";

// Brasília não tem horário de verão desde 2019, então um offset fixo basta.
const UTC_OFFSET_HOURS = -3;
const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;
const HOURS_PER_BUSINESS_DAY = CLOSE_HOUR - OPEN_HOUR;
const HOUR_MS = 60 * 60 * 1000;

interface SlaRule {
  hours: number;
  businessHours: boolean;
  label: string;
}

export const SLA: Record<Priority, SlaRule> = {
  critica: { hours: 1, businessHours: false, label: "1 hora" },
  alta: { hours: 4, businessHours: true, label: "4 horas úteis" },
  media: { hours: 3 * HOURS_PER_BUSINESS_DAY, businessHours: true, label: "3 dias úteis" },
  baixa: { hours: 5 * HOURS_PER_BUSINESS_DAY, businessHours: true, label: "5 dias úteis" },
};

const toLocal = (date: Date) => new Date(date.getTime() + UTC_OFFSET_HOURS * HOUR_MS);
const fromLocal = (date: Date) => new Date(date.getTime() - UTC_OFFSET_HOURS * HOUR_MS);

const isWeekend = (local: Date) => local.getUTCDay() === 0 || local.getUTCDay() === 6;

function nextBusinessMoment(local: Date): Date {
  const cursor = new Date(local);
  for (;;) {
    const hour = cursor.getUTCHours() + cursor.getUTCMinutes() / 60;
    if (isWeekend(cursor) || hour >= CLOSE_HOUR) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(OPEN_HOUR, 0, 0, 0);
      continue;
    }
    if (hour < OPEN_HOUR) cursor.setUTCHours(OPEN_HOUR, 0, 0, 0);
    return cursor;
  }
}

export function addBusinessHours(start: Date, hours: number): Date {
  let cursor = nextBusinessMoment(toLocal(start));
  let remainingMs = hours * HOUR_MS;

  while (remainingMs > 0) {
    const closing = new Date(cursor);
    closing.setUTCHours(CLOSE_HOUR, 0, 0, 0);
    const availableMs = closing.getTime() - cursor.getTime();

    if (remainingMs <= availableMs) {
      cursor = new Date(cursor.getTime() + remainingMs);
      remainingMs = 0;
    } else {
      remainingMs -= availableMs;
      cursor = nextBusinessMoment(closing);
    }
  }
  return fromLocal(cursor);
}

export function dueDate(priority: Priority, from: Date): Date {
  const rule = SLA[priority];
  return rule.businessHours
    ? addBusinessHours(from, rule.hours)
    : new Date(from.getTime() + rule.hours * HOUR_MS);
}

export interface PriorityInput {
  type: TicketType;
  impact: Impact;
  blocksWork: boolean;
  deadlineToday: boolean;
}

export interface PriorityDecision {
  priority: Priority;
  reason: string;
}

export function classifyPriority({ type, impact, blocksWork, deadlineToday }: PriorityInput): PriorityDecision {
  if (impact !== "individual" && blocksWork) {
    return { priority: "critica", reason: `Está parado para ${impact === "empresa" ? "a empresa" : "uma equipe"}` };
  }
  if (blocksWork) {
    return { priority: "alta", reason: "Impede uma pessoa de trabalhar" };
  }
  if (deadlineToday) {
    return { priority: "alta", reason: "Há um compromisso em risco hoje" };
  }
  if (type === "REQ") {
    return { priority: "baixa", reason: "Pedido sem urgência" };
  }
  return { priority: "media", reason: "Atrapalha, mas há alternativa" };
}
