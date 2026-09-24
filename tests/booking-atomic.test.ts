import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { addDays, localDate, zonedToUtc } from "@/lib/time/paris";

// Réservation atomique, avec une base simulée qui reproduit la garantie de
// PostgreSQL en SERIALIZABLE : chaque transaction lit un instantané pris à son
// début ; si une autre transaction a validé un RDV qui chevauche le sien entre
// son début et sa validation, la validation échoue (P2034). Sans ce niveau
// d'isolation, la base simulée valide tout — comme une vraie base en READ
// COMMITTED, où deux réservations simultanées passeraient toutes les deux.

type Appt = { id: string; serviceId: string; startAt: Date; endAt: Date; status: string };

const sim = vi.hoisted(() => ({
  committed: [] as Appt[],
  commitSeq: 0,
  isolationLevels: [] as (string | undefined)[],
  forceP2034: 0,
  apptReads: 0,
  seq: 0,
}));

const SERVICES: Record<string, { id: string; name: string; active: boolean; durationMin: number }> = {
  svc1: { id: "svc1", name: "Appel découverte", active: true, durationMin: 30 },
  svc2: { id: "svc2", name: "Atelier", active: true, durationMin: 60 },
};
const DATE = addDays(localDate(new Date()), 2); // après-demain, heure de Paris
const WEEKDAY = new Date(`${DATE}T12:00:00Z`).getUTCDay();
const WINDOWS = ["svc1", "svc2"].map((serviceId) => ({ serviceId, weekday: WEEKDAY, startTime: "09:00", endTime: "18:00" }));
const tick = () => new Promise((r) => setTimeout(r, 5));

vi.mock("@/lib/server/db", () => {
  const overlapsRange = (a: Appt, w: { startAt?: { lt?: Date }; endAt?: { gt?: Date } }) =>
    (!w.startAt?.lt || a.startAt < w.startAt.lt) && (!w.endAt?.gt || a.endAt > w.endAt.gt);

  const client = (view: () => Appt[], writes: Appt[] | null) => ({
    service: {
      findUnique: async ({ where }: { where: { id: string } }) => SERVICES[where.id] ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => SERVICES[where.id],
    },
    availability: {
      findMany: async ({ where }: { where: { serviceId: string; weekday?: number } }) =>
        WINDOWS.filter((w) => w.serviceId === where.serviceId && (where.weekday === undefined || w.weekday === where.weekday)),
    },
    appointment: {
      findMany: async ({ where }: { where: { startAt?: { lt?: Date }; endAt?: { gt?: Date } } }) => {
        sim.apptReads++;
        await tick(); // laisse les requêtes concurrentes lire avant toute écriture
        return view().filter((a) => ["PENDING", "CONFIRMED"].includes(a.status) && overlapsRange(a, where));
      },
      create: async ({ data }: { data: Omit<Appt, "id" | "status"> }) => {
        const row = { id: `appt${++sim.seq}`, status: "PENDING", ...data };
        if (writes) writes.push(row);
        else sim.committed.push(row);
        return { id: row.id, startAt: row.startAt, endAt: row.endAt, status: row.status };
      },
    },
    calendarEvent: { findMany: async () => [] },
    notification: { create: async () => ({}) },
  });

  const conflict = () => new Prisma.PrismaClientKnownRequestError("could not serialize access", { code: "P2034", clientVersion: "test" });

  return {
    db: {
      ...client(() => sim.committed, null),
      $transaction: async (fn: (tx: unknown) => Promise<unknown>, opts?: { isolationLevel?: string }) => {
        sim.isolationLevels.push(opts?.isolationLevel);
        if (sim.forceP2034 > 0) {
          sim.forceP2034--;
          throw conflict();
        }
        const startSeq = sim.commitSeq;
        const snapshot = [...sim.committed];
        const writes: Appt[] = [];
        const result = await fn(client(() => [...snapshot, ...writes], writes));
        await tick();
        if (opts?.isolationLevel === "Serializable" && writes.length) {
          const concurrent = sim.committed.slice(startSeq);
          if (concurrent.some((c) => writes.some((w) => c.startAt < w.endAt && w.startAt < c.endAt))) throw conflict();
        }
        sim.committed.push(...writes);
        sim.commitSeq = sim.committed.length;
        return result;
      },
    },
  };
});
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

const booking = (startAt: string, extra: Record<string, unknown> = {}) => ({
  serviceId: "svc1",
  startAt,
  visitorName: "Camille Dupont",
  visitorEmail: "camille@example.fr",
  ...extra,
});

async function book(body: unknown) {
  const { POST } = await import("@/app/api/appointments/route");
  const res = await POST(
    new NextRequest("http://localhost/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, body: await res.json() };
}

const TEN = zonedToUtc(DATE, "10:00").toISOString();

beforeEach(() => {
  sim.committed.length = 0;
  sim.commitSeq = 0;
  sim.isolationLevels.length = 0;
  sim.forceP2034 = 0;
  sim.apptReads = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/appointments — atomicité", () => {
  it("5 réservations simultanées du même créneau : exactement 1 × 201 et 4 × 409", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => book(booking(TEN))));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(sim.committed).toHaveLength(1);
    for (const r of results.filter((x) => x.status === 409)) {
      expect(r.body).toEqual({ error: "Ce créneau n'est plus disponible. Choisissez-en un autre." });
    }
  });

  it("la transaction est bien demandée en SERIALIZABLE", async () => {
    await book(booking(TEN));
    expect(sim.isolationLevels).toEqual(["Serializable"]);
  });

  it("deux RDV qui se chevauchent sans commencer à la même heure : un seul passe", async () => {
    // 10:00-11:00 (atelier, 60 min) et 10:30-11:00 (appel, 30 min) : une
    // contrainte d'unicité sur l'heure de début ne verrait pas ce conflit.
    const halfPast = zonedToUtc(DATE, "10:30").toISOString();
    const [a, b] = await Promise.all([book(booking(TEN, { serviceId: "svc2" })), book(booking(halfPast))]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(sim.committed).toHaveLength(1);
  });

  it("conflit de sérialisation persistant (deux P2034) → 409, jamais de 500", async () => {
    sim.forceP2034 = 2;
    const r = await book(booking(TEN));
    expect(r.status).toBe(409);
    expect(sim.committed).toHaveLength(0);
  });

  it("un seul P2034 → rejouée une fois et acceptée", async () => {
    sim.forceP2034 = 1;
    expect((await book(booking(TEN))).status).toBe(201);
    expect(sim.isolationLevels).toHaveLength(2);
  });
});

describe("POST /api/appointments — erreurs différenciées", () => {
  it("créneau passé → 400 explicite", async () => {
    const r = await book(booking(new Date(Date.now() - 3600_000).toISOString()));
    expect(r).toEqual({ status: 400, body: { error: "Ce créneau est déjà passé (réservation au moins 1 h à l'avance)." } });
  });

  it("créneau dans moins d'une heure → 400 (même règle)", async () => {
    expect((await book(booking(new Date(Date.now() + 20 * 60_000).toISOString()))).status).toBe(400);
  });

  it("hors des horaires (08:00, plage 09:00-18:00) → 400 explicite", async () => {
    const r = await book(booking(zonedToUtc(DATE, "08:00").toISOString()));
    expect(r).toEqual({ status: 400, body: { error: "Ce créneau est en dehors des horaires proposés ou au-delà de 60 jours." } });
  });

  it("heure non alignée sur la grille (10:10) → 400", async () => {
    expect((await book(booking(zonedToUtc(DATE, "10:10").toISOString()))).status).toBe(400);
  });

  it("au-delà de 60 jours → 400", async () => {
    const far = addDays(localDate(new Date()), 70);
    expect((await book(booking(zonedToUtc(far, "10:00").toISOString()))).status).toBe(400);
  });

  it("format de date invalide → 400 avec le champ en cause", async () => {
    const r = await book(booking("demain 10h"));
    expect(r.status).toBe(400);
    expect(r.body.issues[0].path).toBe("startAt");
  });

  it("service inconnu → 404", async () => {
    expect((await book(booking(TEN, { serviceId: "inconnu" }))).status).toBe(404);
  });

  it("succès : vraie référence et statut en attente", async () => {
    const r = await book(booking(TEN));
    expect(r.status).toBe(201);
    expect(r.body.appointment).toMatchObject({ status: "PENDING", service: "Appel découverte" });
    expect(r.body.appointment.reference).toMatch(/^RDV-[A-Z0-9]{1,8}$/);
    expect(r.body.appointment.reference).toBe(`RDV-${sim.committed[0].id.slice(-8).toUpperCase()}`);
  });
});

describe("GET /api/public/availability — vue d'ensemble en une passe", () => {
  const get = async (qs: string) => {
    const { GET } = await import("@/app/api/public/availability/route");
    const res = await GET(new NextRequest(`http://localhost/api/public/availability?${qs}`));
    return { status: res.status, body: await res.json() };
  };

  it("14 jours par défaut, une seule lecture des RDV, le jour ouvert a des créneaux", async () => {
    const r = await get("serviceId=svc1");
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(14);
    expect(sim.apptReads).toBe(1);
    const day = r.body.items.find((d: { date: string }) => d.date === DATE);
    expect(day.count).toBe(18); // 09:00 → 17:30, pas de 30 min
  });

  it("un RDV pris retire un créneau du décompte", async () => {
    await book(booking(TEN));
    const r = await get(`serviceId=svc1&from=${DATE}&days=1`);
    expect(r.body.items).toEqual([{ date: DATE, count: 17 }]);
  });

  it.each(["days=61", "days=0", "from=2026-02-30", "from=demain"])("paramètre invalide (%s) → 400", async (qs) => {
    expect((await get(`serviceId=svc1&${qs}`)).status).toBe(400);
  });

  it("service inconnu → 404", async () => {
    expect((await get("serviceId=inconnu")).status).toBe(404);
  });
});
