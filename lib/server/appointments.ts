import "server-only";
import { db } from "@/lib/server/db";

const ACTIVE = { in: ["PENDING", "CONFIRMED"] as ("PENDING" | "CONFIRMED")[] };

/** Prochain RDV actif (en attente ou confirmé), pour le tableau de bord. */
export function getNextAppointment(now = new Date()) {
  return db.appointment.findFirst({
    where: { status: ACTIVE, startAt: { gte: now } },
    orderBy: { startAt: "asc" },
    select: { id: true, startAt: true, status: true, visitorName: true, service: { select: { name: true } } },
  });
}

/** RDV actifs à venir, dont ceux qui attendent une réponse. */
export async function countUpcomingAppointments(now = new Date()) {
  const [upcoming, pending] = await Promise.all([
    db.appointment.count({ where: { status: ACTIVE, startAt: { gte: now } } }),
    db.appointment.count({ where: { status: "PENDING", startAt: { gte: now } } }),
  ]);
  return { upcoming, pending };
}

/** Services actifs, pour les pages publiques rendues côté serveur. */
export function getActiveServices() {
  return db.service.findMany({
    where: { active: true },
    select: { id: true, name: true, durationMin: true, description: true },
    orderBy: { durationMin: "asc" },
  });
}
