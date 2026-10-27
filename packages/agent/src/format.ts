const TIME_ZONE = "America/Sao_Paulo";

export const formatDateTime = (iso: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const formatNow = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

export function daysSince(iso: string, now: Date) {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}
