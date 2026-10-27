const TIME_ZONE = "America/Sao_Paulo";

const time = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "short" });

const clean = (value: string) => value.replace(".", "");

export const formatTime = (iso: string) => time.format(new Date(iso));

export const formatDay = (iso: string) => clean(dayMonth.format(new Date(iso)));

export const formatDayTime = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatRelativeDays(iso: string, now = Date.now()) {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

/** Hora para hoje, "ontem" ou data curta: o formato de listas de conversa. */
export function formatListTime(iso: string, now = new Date()) {
  const day = formatDay(iso);
  if (day === formatDay(now.toISOString())) return formatTime(iso);
  if (day === formatDay(new Date(now.getTime() - DAY_MS).toISOString())) return "ontem";
  return day;
}
