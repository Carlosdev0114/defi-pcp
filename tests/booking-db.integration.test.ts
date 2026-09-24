import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Test d'INTÉGRATION contre la vraie base (Neon), désactivé par défaut pour
// que `npm test` reste sans réseau. Lancement : RUN_DB_TESTS=1 npx vitest run
// tests/booking-db.integration.test.ts
//
// Il prouve la garantie de PostgreSQL elle-même (pas une simulation) :
// 5 réservations simultanées du même créneau → exactement 1 × 201, 4 × 409.
// Seuls le rate limiting et le cache Redis sont neutralisés (ils ne sont pas
// l'objet du test). Toutes les données créées sont supprimées dans un finally.

const RUN = process.env.RUN_DB_TESTS === "1";
if (RUN) process.loadEnvFile?.(".env");

// Le temps réel (incréments Redis best-effort) n'est pas l'objet de ce test.
vi.mock("@/lib/server/realtime", () => ({
  bumpAdminVersion: async () => {},
  bumpConversationVersion: async () => {},
  getAdminVersion: async () => 0,
  getConversationVersion: async () => 0,
}));
vi.mock("@/lib/server/rate-limit", () => ({
  checkLimits: async () => ({ success: true, reset: 0 }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/server/cache", () => ({
  invalidate: async () => {},
  cached: async (_r: string, _k: string, load: () => Promise<unknown>) => load(),
}));

describe.skipIf(!RUN)("réservation concurrente sur PostgreSQL (Neon)", () => {
  it(
    "5 requêtes simultanées sur le même créneau → 1 × 201 et 4 × 409",
    async () => {
      const { db } = await import("@/lib/server/db");
      const { POST } = await import("@/app/api/appointments/route");
      const { addDays, localDate, weekdayOf, zonedToUtc } = await import("@/lib/time/paris");

      const date = addDays(localDate(new Date()), 3);
      const startAt = zonedToUtc(date, "10:00").toISOString();
      const service = await db.service.create({
        data: {
          name: `TEST atomicité ${Date.now()}`,
          durationMin: 30,
          active: true,
          availability: { create: [{ weekday: weekdayOf(date), startTime: "09:00", endTime: "12:00" }] },
        },
      });

      try {
        const request = (i: number) =>
          POST(
            new NextRequest("http://localhost/api/appointments", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                serviceId: service.id,
                startAt,
                visitorName: `Test concurrent ${i}`,
                visitorEmail: `concurrent-${i}@test.example`,
              }),
            })
          );

        const responses = await Promise.all([1, 2, 3, 4, 5].map(request));
        const statuses = responses.map((r) => r.status).sort();
        console.log(`[intégration] statuts obtenus : ${statuses.join(", ")}`);

        expect(statuses).toEqual([201, 409, 409, 409, 409]);
        expect(await db.appointment.count({ where: { serviceId: service.id } })).toBe(1);
      } finally {
        const appointments = await db.appointment.findMany({ where: { serviceId: service.id }, select: { id: true } });
        const ids = appointments.map((a) => a.id);
        await db.notification.deleteMany({
          where: { OR: ids.map((id) => ({ payload: { path: ["appointmentId"], equals: id } })) },
        });
        await db.appointment.deleteMany({ where: { serviceId: service.id } });
        await db.availability.deleteMany({ where: { serviceId: service.id } });
        await db.service.delete({ where: { id: service.id } });
        const leftovers = await db.service.count({ where: { id: service.id } });
        console.log(`[intégration] nettoyage : ${ids.length} RDV supprimé(s), service de test restant : ${leftovers}`);
        await db.$disconnect();
      }
    },
    60_000
  );
});
