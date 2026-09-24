// Fuseau de référence du site : toutes les heures sont saisies et affichées
// en Europe/Paris, quel que soit le fuseau du serveur ou du visiteur. Module
// sans dépendance serveur (utilisé par l'API et par l'interface).

export const SITE_TZ = "Europe/Paris";

/** Écart (ms) entre l'heure locale du fuseau et UTC à un instant donné. */
function tzOffsetMs(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "2026-10-05" + "09:30" à Paris → instant UTC (gère l'heure d'été). */
export function zonedToUtc(date: string, time: string, timeZone = SITE_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, h, min);
  let result = naive - tzOffsetMs(new Date(naive), timeZone);
  const corrected = naive - tzOffsetMs(new Date(result), timeZone);
  if (corrected !== result) result = corrected;
  return new Date(result);
}

/** Date calendaire locale (AAAA-MM-JJ) d'un instant dans le fuseau. */
export function localDate(instant: Date, timeZone = SITE_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** Heure locale (HH:MM) d'un instant dans le fuseau. */
export function localTime(instant: Date, timeZone = SITE_TZ): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** Jour de la semaine (0 = dimanche) d'une date calendaire. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Affichage d'un instant en heure de Paris (« lun. 5 oct., 09:30 »). */
export function formatParis(
  instant: string | Date,
  options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: SITE_TZ, ...options }).format(new Date(instant));
}

/** Libellé d'une date calendaire (« lun. 5 oct. »), sans conversion de fuseau. */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}
