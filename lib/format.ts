import { SITE_TZ } from "@/lib/time/paris";

// Formats d'affichage des dates de contenu (heure de Paris).

export function formatLongDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: SITE_TZ, day: "numeric", month: "long", year: "numeric" }).format(new Date(date));
}

const monthYear = (date: Date | string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: SITE_TZ, month: "short", year: "numeric" }).format(new Date(date));

/** « janv. 2021 — aujourd'hui » */
export function formatPeriod(start: Date | string, end: Date | string | null): string {
  return `${monthYear(start)} — ${end ? monthYear(end) : "aujourd'hui"}`;
}

export function yearOf(date: Date | string | null): string {
  return date ? new Intl.DateTimeFormat("fr-FR", { timeZone: SITE_TZ, year: "numeric" }).format(new Date(date)) : "";
}
