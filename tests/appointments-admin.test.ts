import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { APPOINTMENT_STATUSES, APPOINTMENT_TRANSITIONS, appointmentReference, canTransition } from "@/lib/booking/status";
import { APPOINTMENTS_PAGE_SIZE, appointmentsUrl, blockToApi } from "@/lib/booking/client";
import { formatParis } from "@/lib/time/paris";

// Vue admin des RDV : pagination serveur, protection 401, transitions.

const m = vi.hoisted(() => ({
  db: {
    appointment: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/server/db", () => ({ db: m.db }));
vi.mock("@/lib/server/guard", () => ({
  requireAdmin: m.requireAdmin,
  unauthorized: () => Response.json({ error: "Non autorisé." }, { status: 401 }),
}));
vi.mock("@/lib/server/cache", () => ({ invalidate: async () => {} }));

const get = (qs: string) => new NextRequest(`http://localhost/api/admin/appointments?${qs}`);
const patch = (id: string, body: unknown) =>
  new NextRequest(`http://localhost/api/admin/appointments/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const appt = (i: number) => ({
  id: `ckappointment0000000${i}`,
  status: "PENDING",
  startAt: new Date(),
  endAt: new Date(),
  service: { id: "s", name: "Appel", durationMin: 30 },
});

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockResolvedValue({ id: "admin-1", email: "a@b.c", name: "Admin" });
  m.db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof m.db) => unknown)(m.db) : Promise.all(arg as Promise<unknown>[])
  );
  m.db.appointment.groupBy.mockResolvedValue([
    { status: "PENDING", _count: { _all: 25 } },
    { status: "CONFIRMED", _count: { _all: 2 } },
  ]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/admin/appointments — pagination serveur", () => {
  it("page 2 de 20 : skip 20 / take 20, totalPages, totaux par statut, référence", async () => {
    m.db.appointment.findMany.mockResolvedValue([appt(1), appt(2)]);
    m.db.appointment.count.mockResolvedValue(25);
    const { GET } = await import("@/app/api/admin/appointments/route");
    const body = await (await GET(get("page=2&pageSize=20&status=PENDING"))).json();

    expect(m.db.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20, where: { status: "PENDING" } })
    );
    expect(body).toMatchObject({ page: 2, total: 25, totalPages: 2 });
    expect(body.counts).toEqual({ PENDING: 25, CONFIRMED: 2, DECLINED: 0, CANCELLED: 0, COMPLETED: 0 });
    expect(body.items[0].reference).toBe(appointmentReference(appt(1).id));
  });

  it.each(["pageSize=51", "page=0", "status=pending"])("paramètre invalide (%s) → 400", async (qs) => {
    const { GET } = await import("@/app/api/admin/appointments/route");
    expect((await GET(get(qs))).status).toBe(400);
    expect(m.db.appointment.findMany).not.toHaveBeenCalled();
  });

  it("le client demande des pages de 20", () => {
    expect(APPOINTMENTS_PAGE_SIZE).toBe(20);
    expect(appointmentsUrl({ status: "CONFIRMED", page: 2 })).toBe("/api/admin/appointments?page=2&pageSize=20&status=CONFIRMED");
  });
});

describe("routes RDV admin sans session → 401, base jamais touchée", () => {
  beforeEach(() => m.requireAdmin.mockResolvedValue(null));

  it("GET liste et PATCH statut", async () => {
    const { GET } = await import("@/app/api/admin/appointments/route");
    const { PATCH } = await import("@/app/api/admin/appointments/[id]/route");
    expect((await GET(get("page=1"))).status).toBe(401);
    expect((await PATCH(patch("appt1", { status: "CONFIRMED" }), ctx("appt1"))).status).toBe(401);
    expect(m.db.appointment.findMany).not.toHaveBeenCalled();
    expect(m.db.appointment.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/appointments/[id] — transitions", () => {
  it("PENDING → CONFIRMED accepté (et assigné à l'admin)", async () => {
    m.db.appointment.findUniqueOrThrow.mockResolvedValue({ status: "PENDING" });
    m.db.appointment.update.mockResolvedValue({ id: "appt1", status: "CONFIRMED" });
    const { PATCH } = await import("@/app/api/admin/appointments/[id]/route");
    expect((await PATCH(patch("appt1", { status: "CONFIRMED" }), ctx("appt1"))).status).toBe(200);
    expect(m.db.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt1" },
      data: { status: "CONFIRMED", assignedToId: "admin-1" },
    });
  });

  it("CANCELLED → CONFIRMED refusé (409), rien écrit", async () => {
    m.db.appointment.findUniqueOrThrow.mockResolvedValue({ status: "CANCELLED" });
    const { PATCH } = await import("@/app/api/admin/appointments/[id]/route");
    expect((await PATCH(patch("appt1", { status: "CONFIRMED" }), ctx("appt1"))).status).toBe(409);
    expect(m.db.appointment.update).not.toHaveBeenCalled();
  });

  it("les transitions sont les mêmes côté API et côté interface", () => {
    for (const from of APPOINTMENT_STATUSES) {
      for (const to of APPOINTMENT_STATUSES) expect(canTransition(from, to)).toBe(APPOINTMENT_TRANSITIONS[from].includes(to));
    }
    expect(APPOINTMENT_TRANSITIONS.COMPLETED).toEqual([]);
  });
});

describe("heures de Paris", () => {
  it("un blocage saisi en heure de Paris est converti en UTC (été : +2 h, hiver : +1 h)", () => {
    expect(blockToApi({ title: "x", date: "2026-07-10", start: "14:00", end: "16:00" })).toMatchObject({
      startAt: "2026-07-10T12:00:00.000Z",
      endAt: "2026-07-10T14:00:00.000Z",
    });
    expect(blockToApi({ title: "x", date: "2026-12-10", start: "14:00", end: "16:00" }).startAt).toBe("2026-12-10T13:00:00.000Z");
  });

  it("l'affichage est en heure de Paris quel que soit le fuseau du poste", () => {
    expect(formatParis("2026-07-10T12:00:00Z", { hour: "2-digit", minute: "2-digit" })).toBe("14:00");
    expect(formatParis("2026-12-10T13:00:00Z", { hour: "2-digit", minute: "2-digit" })).toBe("14:00");
  });
});
