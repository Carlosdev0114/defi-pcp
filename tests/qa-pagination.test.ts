import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MAX_PAGE_SIZE, paginated, paginationSchema, toSkipTake } from "@/lib/server/api";

// QA — brief 1(d). Le brief exige : « chaque liste est paginée côté serveur,
// taille max imposée (limit=100000 plafonné) ». Deux couches de preuve :
//   1. UNITAIRE : paginationSchema refuse (400) pageSize > 50 — la taille max
//      est IMPOSÉE, pas seulement conseillée ; toSkipTake/paginated cohérents.
//   2. ROUTE : GET /api/admin/media répond 400 pour pageSize=100000 sans même
//      interroger la base (findMany jamais appelé), et applique skip/take
//      pour les valeurs légales.
//   3. BALAYAGE : toute route (admin OU public) qui sérialise une liste avec
//      `paginated(` DOIT aussi référencer `paginationSchema` — la règle de
//      borne n'est donc pas contournable par une future route.

const ROOT = process.cwd();

const m = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; name: string | null; role: string },
  findMany: [] as Array<Record<string, unknown>>,
  total: 1,
}));

vi.mock("@/lib/server/session", () => ({
  getCurrentSession: async () => (m.user ? { userId: m.user.id, role: m.user.role, email: m.user.email, sessionId: "s" } : null),
}));
vi.mock("@/lib/server/db", () => ({
  db: {
    user: { findUnique: async () => (m.user ? { id: m.user.id, email: m.user.email, name: m.user.name, role: m.user.role } : null) },
    media: {
      findMany: async (args: Record<string, unknown>) => {
        m.findMany.push(args);
        return [{ id: "m1", url: "123e4567-e89b-42d3-a456-426614174000.webp", mimeType: "image/webp", width: 1, height: 1, sizeBytes: 1, altText: null, createdAt: new Date(0) }];
      },
      count: async () => m.total,
    },
    $transaction: async (arg: unknown[]) => Promise.all(arg),
  },
}));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

beforeEach(() => {
  m.user = { id: "u1", email: "admin@test.fr", name: "Admin", role: "ADMIN" };
  m.findMany.length = 0;
  m.total = 1;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QA 1(d) — paginationSchema : la taille max est imposée (refus, pas de clamp)", () => {
  it("pageSize limite = 50 (MAX_PAGE_SIZE, vérifiée par le comportement du schéma)", () => {
    expect(MAX_PAGE_SIZE).toBe(50);
    expect(paginationSchema.safeParse({ pageSize: MAX_PAGE_SIZE }).success).toBe(true);
    expect(paginationSchema.safeParse({ pageSize: MAX_PAGE_SIZE + 1 }).success).toBe(false);
  });

  it("pageSize ≤ 50 accepté, pageSize > 50 REFUSÉ (400 implicite)", () => {
    expect(paginationSchema.safeParse({ pageSize: 50 }).success).toBe(true);
    expect(paginationSchema.safeParse({ pageSize: 51 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: 100000 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: "100000" }).success).toBe(false);
    expect(paginationSchema.safeParse({ page: 1, pageSize: 100000 }).success).toBe(false);
  });

  it("page bornée aussi (max 10 000)", () => {
    expect(paginationSchema.safeParse({ page: 10000 }).success).toBe(true);
    expect(paginationSchema.safeParse({ page: 10001 }).success).toBe(false);
  });

  it("défauts et math de pagination cohérents", () => {
    const ok = paginationSchema.safeParse({});
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data).toEqual({ page: 1, pageSize: 20 });
    expect(toSkipTake({ page: 2, pageSize: 50 })).toEqual({ skip: 50, take: 50 });
    expect(paginated([], 150, { page: 1, pageSize: 50 }).totalPages).toBe(3);
  });
});

describe("QA 1(d) — route GET /api/admin/media", () => {
  const get = (query: string) => new NextRequest(`http://localhost/api/admin/media?${query}`);

  it("pageSize=100000 → 400, et AUCUNE requête de liste en base", async () => {
    const { GET } = await import("@/app/api/admin/media/route");
    const res = await GET(get("pageSize=100000&page=1"));
    expect(res.status).toBe(400);
    expect(m.findMany).toHaveLength(0);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Entrées invalides.");
  });

  it("page=10001 → 400, borne haute de page respectée", async () => {
    const { GET } = await import("@/app/api/admin/media/route");
    expect((await GET(get("page=10001"))).status).toBe(400);
    expect(m.findMany).toHaveLength(0);
  });

  it("pageSize=50&page=2 → 200, take=50, skip=50 en base, réponse paginée", async () => {
    m.total = 137;
    const { GET } = await import("@/app/api/admin/media/route");
    const res = await GET(get("pageSize=50&page=2"));
    expect(res.status).toBe(200);
    expect(m.findMany).toHaveLength(1);
    expect(m.findMany[0]).toMatchObject({ orderBy: { createdAt: "desc" }, skip: 50, take: 50 });
    const body = (await res.json()) as { page: number; pageSize: number; total: number; totalPages: number; items: unknown[] };
    expect(body).toMatchObject({ page: 2, pageSize: 50, total: 137, totalPages: 3 });
    expect(body.items).toHaveLength(1);
  });
});

describe("QA 1(d) — balayage : toute liste paginée passe par paginationSchema", () => {
  it("toutes les routes admin ET publiques qui sérialisent via `paginated(` référencent paginationSchema + toSkipTake", () => {
    const files = walk(path.join(ROOT, "app", "api")).filter((f) => f.endsWith("route.ts"));
    const lists = files.filter((f) => readFileSync(f, "utf8").includes("paginated("));
    expect(lists.length).toBeGreaterThanOrEqual(6);
    const failures: string[] = [];
    for (const f of lists) {
      const src = readFileSync(f, "utf8");
      const rel = path.relative(ROOT, f).split(path.sep).join("/");
      if (!src.includes("paginationSchema")) failures.push(`${rel} → liste sans paginationSchema`);
      if (!src.includes("toSkipTake")) failures.push(`${rel} → liste sans toSkipTake`);
    }
    expect(failures, `routes de liste non conformes :\n${failures.join("\n")}`).toEqual([]);
  });

  it("la messagerie visiteur est bornée côté serveur (50 derniers messages, curseur)", () => {
    expect(readFileSync(path.join(ROOT, "lib", "server", "messaging.ts"), "utf8")).toMatch(/const PAGE = 50;/);
  });
});