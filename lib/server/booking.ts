import type { Prisma, PrismaClient } from "@prisma/client";
import { SITE_TZ, addDays, isRealDate, localDate, localTime, weekdayOf, zonedToUtc } from "@/lib/time/paris";

// Calcul des créneaux réservables. Règle : Availability (récurrent, par jour
// de semaine) MOINS CalendarEvent bloquants (exceptions datées) MOINS les
// Appointment déjà PENDING/CONFIRMED (une seule personne reçoit les RDV, donc
// tout RDV bloque le créneau quel que soit son service).

export const BOOKING_TZ = SITE_TZ;
const STEP_MIN = 30; // granularité des créneaux proposés
export const MIN_LEAD_MS = 60 * 60 * 1000; // pas de RDV dans l'heure qui vient
export const MAX_HORIZON_DAYS = 60;

export { localDate, zonedToUtc };

type Db = PrismaClient | Prisma.TransactionClient;

export type Slot = { startAt: string; endAt: string; time: string };
type Window = { weekday: number; startTime: string; endTime: string };
type Interval = readonly [number, number];

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/** Date dans l'horizon réservable [aujourd'hui, aujourd'hui + 60 j] ? */
function inHorizon(date: string, now: Date) {
  const today = localDate(now);
  return isRealDate(date) && date >= today && date <= addDays(today, MAX_HORIZON_DAYS);
}

/**
 * Calcul pur des créneaux d'une date : pas de 30 min dans chaque plage
 * horaire, durée du service entièrement contenue dans la plage, au moins
 * 1 h à l'avance, sans chevauchement avec `busy`.
 */
function computeSlots(date: string, windows: Window[], durationMin: number, busy: Interval[], now: Date): Slot[] {
  const weekday = weekdayOf(date);
  const durationMs = durationMin * 60_000;
  const earliest = now.getTime() + MIN_LEAD_MS;
  const slots: Slot[] = [];
  const seen = new Set<number>();

  for (const w of windows.filter((x) => x.weekday === weekday)) {
    const windowEnd = zonedToUtc(date, w.endTime).getTime();
    for (let start = zonedToUtc(date, w.startTime).getTime(); start + durationMs <= windowEnd; start += STEP_MIN * 60_000) {
      const end = start + durationMs;
      if (start < earliest || seen.has(start)) continue;
      if (busy.some(([bs, be]) => overlaps(start, end, bs, be))) continue;
      seen.add(start);
      slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), time: localTime(new Date(start)) });
    }
  }
  return slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Périodes occupées (RDV actifs + blocages) qui touchent [from, to[. */
async function busyBetween(db: Db, from: Date, to: Date): Promise<Interval[]> {
  const [appointments, blocks] = await Promise.all([
    db.appointment.findMany({
      where: { status: { in: ["PENDING", "CONFIRMED"] }, startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true },
    }),
    db.calendarEvent.findMany({
      where: { blocked: true, startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true },
    }),
  ]);
  return [...appointments, ...blocks].map((b) => [b.startAt.getTime(), b.endAt.getTime()] as const);
}

async function activeService(db: Db, serviceId: string) {
  const service = await db.service.findUnique({ where: { id: serviceId }, select: { active: true, durationMin: true } });
  return service?.active ? service : null;
}

/**
 * Créneaux libres d'un service pour une date locale. Renvoie `null` si le
 * service n'existe pas / est inactif, [] si la date est hors horizon.
 */
export async function getAvailableSlots(db: Db, serviceId: string, date: string, now = new Date()): Promise<Slot[] | null> {
  const service = await activeService(db, serviceId);
  if (!service) return null;
  if (!inHorizon(date, now)) return [];

  const [windows, busy] = await Promise.all([
    db.availability.findMany({ where: { serviceId, weekday: weekdayOf(date) } }),
    busyBetween(db, zonedToUtc(date, "00:00"), zonedToUtc(addDays(date, 1), "00:00")),
  ]);
  return computeSlots(date, windows, service.durationMin, busy, now);
}

export type DayAvailability = { date: string; count: number };

/**
 * Nombre de créneaux libres par jour sur `days` jours à partir de `from`, en
 * UNE passe : trois requêtes au total (service, plages, occupations sur toute
 * la période), puis calcul en mémoire jour par jour.
 */
export async function getAvailabilitySummary(
  db: Db,
  serviceId: string,
  from: string,
  days: number,
  now = new Date()
): Promise<DayAvailability[] | null> {
  const service = await activeService(db, serviceId);
  if (!service) return null;

  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const [windows, busy] = await Promise.all([
    db.availability.findMany({ where: { serviceId } }),
    busyBetween(db, zonedToUtc(from, "00:00"), zonedToUtc(addDays(from, days), "00:00")),
  ]);
  return dates.map((date) => ({
    date,
    count: inHorizon(date, now) ? computeSlots(date, windows, service.durationMin, busy, now).length : 0,
  }));
}

export type SlotCheck =
  | { ok: true; endAt: Date }
  | { ok: false; reason: "service" | "past" | "outside" | "taken" };

/**
 * Vérifie qu'un début de RDV est réservable, avec une raison précise sinon :
 * service inconnu, créneau passé (ou dans l'heure), hors des horaires ou de
 * l'horizon, ou déjà occupé. À appeler DANS la transaction de réservation.
 */
export async function checkSlot(db: Db, serviceId: string, startAt: Date, now = new Date()): Promise<SlotCheck> {
  const service = await activeService(db, serviceId);
  if (!service) return { ok: false, reason: "service" };
  if (startAt.getTime() < now.getTime() + MIN_LEAD_MS) return { ok: false, reason: "past" };

  const date = localDate(startAt);
  if (!inHorizon(date, now)) return { ok: false, reason: "outside" };

  const windows = await db.availability.findMany({ where: { serviceId, weekday: weekdayOf(date) } });
  const matches = (slots: Slot[]) => slots.find((s) => new Date(s.startAt).getTime() === startAt.getTime());

  // Le créneau existe-t-il dans les horaires (sans tenir compte des occupations) ?
  if (!matches(computeSlots(date, windows, service.durationMin, [], now))) return { ok: false, reason: "outside" };

  const busy = await busyBetween(db, zonedToUtc(date, "00:00"), zonedToUtc(addDays(date, 1), "00:00"));
  const free = matches(computeSlots(date, windows, service.durationMin, busy, now));
  return free ? { ok: true, endAt: new Date(free.endAt) } : { ok: false, reason: "taken" };
}
