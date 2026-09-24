import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeRedis } from "./helpers/fake-redis";
import { addDays, localDate } from "@/lib/time/paris";
import { resetKnownPaths } from "@/lib/server/visits";

// Comptage des visites : vrai code (routes + lib/server/visits) sur Redis
// simulé. Les slugs connus viennent d'un mock déterministe : AUCUN accès à la
// vraie base (le test doit passer sans DATABASE_URL).

const m = vi.hoisted(() => ({
  redis: null as unknown as ReturnType<typeof import("./helpers/fake-redis").createFakeRedis>,
  limit: { success: true, reset: 0 },
  limitKeys: [] as string[],
}));
vi.mock("@/lib/server/redis", () => ({ getRedis: () => m.redis }));
vi.mock("@/lib/server/content", () => ({
  getPublishedSlugs: async () => ({ projects: ["projet-omega"], articles: ["notation-et-recette"] }),
}));
vi.mock("@/lib/server/rate-limit", () => ({
  GLOBAL_KEY: "all",
  checkLimits: async (checks: [string, string][]) => {
    m.limitKeys.push(...checks.map(([r, k]) => `${r}:${k}`));
    return m.limit;
  },
}));

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const IP = "203.0.113.77";

async function beacon(path: unknown, ua: string | null = BROWSER_UA) {
  const { POST } = await import("@/app/api/public/visit/route");
  return POST(
    new NextRequest("http://localhost/api/public/visit", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": IP, "x-forwarded-for": IP, ...(ua ? { "user-agent": ua } : {}) },
      body: JSON.stringify({ path }),
    })
  );
}

const today = () => localDate(new Date());
const dayCount = () => Number(m.redis.store.get(`visits:d:${today()}`) ?? 0);

beforeEach(() => {
  m.redis = createFakeRedis();
  m.limit = { success: true, reset: 0 };
  m.limitKeys.length = 0;
  // Le cache des chemins connus vit sur globalThis : le vider garantit un
  // résultat identique quel que soit l'ordre ou les fichiers voisins.
  resetKnownPaths();
  vi.stubEnv("TRUST_PROXY", "true");
});

describe("POST /api/public/visit", () => {
  it("compte une page vue connue (jour + chemin), réponse 204", async () => {
    const res = await beacon("/projets");
    expect(res.status).toBe(204);
    expect(dayCount()).toBe(1);
    expect(m.redis.store.get(`visits:p:${today()}`)).toEqual({ "/projets": 1 });
  });

  it("normalise : query, ancre et / final retirés ; pages de détail connues acceptées", async () => {
    await beacon("/projets/?utm_source=x#top");
    await beacon("/articles/notation-et-recette");
    expect(m.redis.store.get(`visits:p:${today()}`)).toEqual({ "/projets": 1, "/articles/notation-et-recette": 1 });
  });

  it.each([["/admin"], ["/api/chat"], ["/projets/inexistant"], ["/../etc/passwd"], ["https://evil.example/"]])(
    "chemin inconnu (%j) → ignoré",
    async (path) => {
      expect((await beacon(path)).status).toBe(204);
      expect(dayCount()).toBe(0);
    }
  );

  it("corps invalide (chemin non textuel) → 400 de validation, rien compté", async () => {
    expect((await beacon(42)).status).toBe(400);
    expect(dayCount()).toBe(0);
  });

  it.each([["Googlebot/2.1 (+http://www.google.com/bot.html)"], ["Mozilla/5.0 HeadlessChrome/140.0"], ["curl/8.4.0"], [null]])(
    "robot ou User-Agent absent (%s) → ignoré",
    async (ua) => {
      await beacon("/", ua);
      expect(dayCount()).toBe(0);
    }
  );

  it("limite GLOBALE (clé unique, jamais l'IP) ; dépassée → rien compté", async () => {
    await beacon("/");
    expect(m.limitKeys).toEqual(["visitGlobal:all"]);
    m.limit = { success: false, reset: 0 };
    await beacon("/");
    expect(dayCount()).toBe(1);
  });

  it("aucune IP ni User-Agent n'est stocké dans Redis", async () => {
    await beacon("/contact");
    const everything = JSON.stringify([...m.redis.store.entries()]);
    expect(everything).not.toContain(IP);
    expect(everything).not.toContain("Chrome");
    expect([...m.redis.store.keys()].every((k) => /^visits:[dp]:\d{4}-\d{2}-\d{2}$/.test(k))).toBe(true);
  });
});

describe("getVisitStats", () => {
  it("30 jours + période précédente, pages les plus vues agrégées", async () => {
    const { getVisitStats } = await import("@/lib/server/visits");
    const d0 = today();
    const yesterday = addDays(d0, -1);
    const older = addDays(d0, -40); // période précédente
    m.redis.store.set(`visits:d:${d0}`, 5);
    m.redis.store.set(`visits:d:${yesterday}`, 3);
    m.redis.store.set(`visits:d:${older}`, 4);
    m.redis.store.set(`visits:p:${d0}`, { "/": 3, "/projets": 2 });
    m.redis.store.set(`visits:p:${yesterday}`, { "/projets": 3 });

    const stats = await getVisitStats(30);
    expect(stats.days).toHaveLength(30);
    expect(stats.days.at(-1)).toEqual({ date: d0, views: 5 });
    expect(stats.total).toBe(8);
    expect(stats.previousTotal).toBe(4);
    expect(stats.topPages).toEqual([{ path: "/projets", views: 5 }, { path: "/", views: 3 }]);
  });
});
