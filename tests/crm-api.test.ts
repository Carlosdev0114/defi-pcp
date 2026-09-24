import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { summarizePipeline } from "@/lib/server/crm";
import { LEAD_STAGES, LEAD_STATUSES } from "@/lib/crm/stages";
import { leadsUrl, LEADS_PAGE_SIZE } from "@/lib/crm/client";

// Routes CRM du back-office : pagination serveur, protection 401, et
// changement de statut journalisé. Base et session simulées.

const m = vi.hoisted(() => {
  const db = {
    lead: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    leadEvent: { create: vi.fn() },
    leadNote: { create: vi.fn() },
    activity: { create: vi.fn() },
    notification: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, requireAdmin: vi.fn() };
});

vi.mock("@/lib/server/db", () => ({ db: m.db }));
// Le temps réel (incréments Redis best-effort) n'est pas l'objet de ce test.
vi.mock("@/lib/server/realtime", () => ({
  bumpAdminVersion: async () => {},
  bumpConversationVersion: async () => {},
  getAdminVersion: async () => 0,
  getConversationVersion: async () => 0,
}));
vi.mock("@/lib/server/guard", () => ({
  requireAdmin: m.requireAdmin,
  unauthorized: () => Response.json({ error: "Non autorisé." }, { status: 401 }),
}));

const ADMIN = { id: "admin-1", email: "a@b.c", name: "Admin" };
const lead = (i: number) => ({ id: `lead${i}`, status: "NEW", value: null, source: "Formulaire de contact", contact: { name: `N${i}`, email: `n${i}@x.fr` } });

const get = (url: string) => new NextRequest(`http://localhost${url}`);
const json = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockResolvedValue(ADMIN);
  // $transaction : tableau de requêtes → Promise.all ; fonction → exécutée avec la même base.
  m.db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof m.db) => unknown)(m.db) : Promise.all(arg as Promise<unknown>[])
  );
  m.db.lead.groupBy.mockResolvedValue([
    { status: "NEW", _count: { _all: 40 }, _sum: { value: null } },
    { status: "PROPOSAL", _count: { _all: 3 }, _sum: { value: 12000 } },
    { status: "WON", _count: { _all: 2 }, _sum: { value: 9000 } },
  ]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/admin/leads — pagination serveur", () => {
  it("page 2 de 20 : skip 20 / take 20, totalPages calculé sur le total", async () => {
    m.db.lead.findMany.mockResolvedValue(Array.from({ length: 20 }, (_, i) => lead(20 + i)));
    m.db.lead.count.mockResolvedValue(45);
    const { GET } = await import("@/app/api/admin/leads/route");

    const res = await GET(get("/api/admin/leads?page=2&pageSize=20"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(m.db.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20, where: {} }));
    expect(body).toMatchObject({ page: 2, pageSize: 20, total: 45, totalPages: 3 });
    expect(body.items).toHaveLength(20);
  });

  it("filtre par statut appliqué à la liste ET au total", async () => {
    m.db.lead.findMany.mockResolvedValue([]);
    m.db.lead.count.mockResolvedValue(3);
    const { GET } = await import("@/app/api/admin/leads/route");
    await GET(get("/api/admin/leads?status=PROPOSAL&page=1&pageSize=20"));
    expect(m.db.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "PROPOSAL" }, skip: 0 }));
    expect(m.db.lead.count).toHaveBeenCalledWith({ where: { status: "PROPOSAL" } });
  });

  it("renvoie les totaux du pipeline pour les onglets (tous les stades, 0 compris)", async () => {
    m.db.lead.findMany.mockResolvedValue([]);
    m.db.lead.count.mockResolvedValue(0);
    const { GET } = await import("@/app/api/admin/leads/route");
    const { pipeline } = await (await GET(get("/api/admin/leads"))).json();
    expect(pipeline.stages.map((s: { status: string }) => s.status)).toEqual([...LEAD_STATUSES]);
    expect(pipeline).toMatchObject({ total: 45, open: 43, won: 2, inProgressValue: 12000 });
  });

  it.each(["pageSize=51", "page=0", "status=nouveau", "page=abc"])("paramètre invalide (%s) → 400, sans requête", async (qs) => {
    const { GET } = await import("@/app/api/admin/leads/route");
    expect((await GET(get(`/api/admin/leads?${qs}`))).status).toBe(400);
    expect(m.db.lead.findMany).not.toHaveBeenCalled();
  });

  it("le client demande bien des pages de 20", () => {
    expect(LEADS_PAGE_SIZE).toBe(20);
    expect(leadsUrl({ status: "WON", page: 3 })).toBe("/api/admin/leads?page=3&pageSize=20&status=WON");
    expect(leadsUrl({ status: null, page: 1 })).toBe("/api/admin/leads?page=1&pageSize=20");
  });
});

describe("routes CRM sans session admin → 401, base jamais touchée", () => {
  beforeEach(() => m.requireAdmin.mockResolvedValue(null));

  it("GET /api/admin/leads", async () => {
    const { GET } = await import("@/app/api/admin/leads/route");
    const res = await GET(get("/api/admin/leads"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Non autorisé." });
  });

  it("GET et PATCH /api/admin/leads/[id]", async () => {
    const { GET, PATCH } = await import("@/app/api/admin/leads/[id]/route");
    expect((await GET(get("/api/admin/leads/lead1"), ctx("lead1"))).status).toBe(401);
    expect((await PATCH(json("/api/admin/leads/lead1", "PATCH", { status: "WON" }), ctx("lead1"))).status).toBe(401);
  });

  it("POST /api/admin/leads/[id]/notes", async () => {
    const { POST } = await import("@/app/api/admin/leads/[id]/notes/route");
    expect((await POST(json("/api/admin/leads/lead1/notes", "POST", { content: "x" }), ctx("lead1"))).status).toBe(401);
  });

  it("aucune lecture ni écriture en base", () => {
    for (const fn of [m.db.lead.findMany, m.db.lead.count, m.db.lead.update, m.db.leadEvent.create, m.db.leadNote.create]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe("PATCH /api/admin/leads/[id] — changement de statut", () => {
  it("met à jour le statut et journalise l'événement from → to", async () => {
    m.db.lead.findUniqueOrThrow.mockResolvedValue({ status: "NEW", contact: { name: "Camille" } });
    m.db.lead.update.mockResolvedValue({ id: "lead1", status: "CONTACTED" });
    const { PATCH } = await import("@/app/api/admin/leads/[id]/route");

    const res = await PATCH(json("/api/admin/leads/lead1", "PATCH", { status: "CONTACTED" }), ctx("lead1"));

    expect(res.status).toBe(200);
    expect(m.db.lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { status: "CONTACTED" } });
    expect(m.db.leadEvent.create).toHaveBeenCalledWith({ data: { leadId: "lead1", fromStatus: "NEW", toStatus: "CONTACTED" } });
    expect(m.db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("statut inconnu → 400", async () => {
    const { PATCH } = await import("@/app/api/admin/leads/[id]/route");
    expect((await PATCH(json("/api/admin/leads/lead1", "PATCH", { status: "gagne" }), ctx("lead1"))).status).toBe(400);
    expect(m.db.lead.update).not.toHaveBeenCalled();
  });
});

describe("table des stades et totaux", () => {
  it("chaque statut de la base a un libellé", () => {
    for (const s of LEAD_STATUSES) expect(LEAD_STAGES[s].label).toBeTruthy();
  });

  it("summarizePipeline complète les stades absents à 0", () => {
    const summary = summarizePipeline([{ status: "LOST", _count: { _all: 4 }, _sum: { value: 100 } }]);
    expect(summary.stages).toHaveLength(6);
    expect(summary).toMatchObject({ total: 4, open: 0, won: 0, inProgressValue: 0 });
  });
});
