import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DynamicServerError } from "next/dist/client/components/hooks-server-context";
import { redirect } from "next/navigation";
import { DEFAULT_MODULES, DEFAULT_PROFILE, DEFAULT_SETTINGS } from "@/lib/schemas/site";

// site-config : lectures Redis de la configuration publique.
//  1. read() se replie sur les valeurs par défaut si Redis est indisponible,
//     MAIS laisse passer les signaux internes de Next (unstable_rethrow) ;
//  2. profil et modules passent par unstable_cache, étiquetés par clé
//     (site:profile, site:modules) : une seule lecture Redis tant que
//     l'étiquette n'est pas expirée, jamais de panne mise en cache ;
//  3. les écritures admin (PUT profil, PUT paramètres) expirent l'étiquette :
//     la lecture suivante relit Redis et voit la nouvelle valeur.
//
// Hors du runtime Next, unstable_cache n'a pas de cache incrémental : il est
// remplacé par un cache en mémoire qui en reproduit les règles utiles ici
// (clé = keyParts, seules les promesses résolues sont gardées, invalidation
// par étiquette).

const r = vi.hoisted(() => ({ store: new Map<string, unknown>(), get: vi.fn(), set: vi.fn() }));
vi.mock("@/lib/server/redis", () => ({ getRedis: () => ({ get: r.get, set: r.set }) }));

const nc = vi.hoisted(() => {
  const entries = new Map<string, { value: unknown; tags: string[] }>();
  return {
    entries,
    unstable_cache:
      (fn: () => Promise<unknown>, keyParts: string[], opts?: { tags?: string[] }) =>
      async () => {
        const key = JSON.stringify(keyParts);
        const hit = entries.get(key);
        if (hit) return hit.value;
        const value = await fn(); // rejet → rien n'est mis en cache
        entries.set(key, { value, tags: opts?.tags ?? [] });
        return value;
      },
    revalidateTag: vi.fn((tag: string) => {
      for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
    }),
    revalidatePath: vi.fn(),
  };
});
vi.mock("next/cache", () => ({ unstable_cache: nc.unstable_cache, revalidateTag: nc.revalidateTag, revalidatePath: nc.revalidatePath }));

// Dépendances des routes admin, hors sujet ici.
const admin = { id: "u1", email: "admin@test.fr", name: "Admin", role: "ADMIN" };
vi.mock("@/lib/server/session", () => ({
  getCurrentSession: async () => ({ userId: admin.id, role: admin.role, email: admin.email, sessionId: "s" }),
}));
vi.mock("@/lib/server/db", () => ({
  db: { user: { findUnique: async () => admin }, activity: { create: async () => ({ id: "a1" }) } },
}));
vi.mock("@/lib/server/cache", () => ({ invalidate: async () => {} }));
vi.mock("@/lib/server/rag/index", () => ({ markRagStale: async () => {} }));
vi.mock("@/lib/server/visits", () => ({ resetKnownPaths: () => {} }));

const put = (url: string, body: unknown) =>
  new NextRequest("http://localhost" + url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  r.store.clear();
  r.get.mockReset().mockImplementation(async (key: string) => (r.store.has(key) ? r.store.get(key) : null));
  r.set.mockReset().mockImplementation(async (key: string, value: unknown) => void r.store.set(key, value));
  nc.entries.clear();
  nc.revalidateTag.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("site-config — lecture Redis", () => {
  it("signal de rendu dynamique (DYNAMIC_SERVER_USAGE) → propagé, pas de valeurs par défaut", async () => {
    const signal = new DynamicServerError("Route / couldn't be rendered statically");
    r.get.mockRejectedValue(signal);
    const { getProfile } = await import("@/lib/server/site-config");
    await expect(getProfile()).rejects.toBe(signal);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("redirect() levé pendant la lecture → propagé (NEXT_REDIRECT)", async () => {
    r.get.mockImplementation(async () => redirect("/login"));
    const { getProfile } = await import("@/lib/server/site-config");
    await expect(getProfile()).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT/) });
  });

  it("vraie panne Redis → valeurs par défaut, erreur journalisée", async () => {
    r.get.mockRejectedValue(new Error("ECONNRESET"));
    const { getProfile } = await import("@/lib/server/site-config");
    await expect(getProfile()).resolves.toEqual(DEFAULT_PROFILE);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});

describe("site-config — cache par étiquette", () => {
  it("profil et modules : une seule lecture Redis tant que l'étiquette est valide", async () => {
    const { getModules, getProfile } = await import("@/lib/server/site-config");
    await getProfile();
    await getProfile();
    await getModules();
    await getModules();
    expect(r.get.mock.calls.map(([key]) => key)).toEqual(["public:profile", "public:modules"]);
    expect([...nc.entries.values()].map((e) => e.tags)).toEqual([["site:profile"], ["site:modules"]]);
  });

  it("une panne Redis n'est pas mise en cache : la lecture suivante relit Redis", async () => {
    r.store.set("public:profile", { ...DEFAULT_PROFILE, name: "Camille Roux" });
    r.get.mockRejectedValueOnce(new Error("ECONNRESET"));
    const { getProfile } = await import("@/lib/server/site-config");
    await expect(getProfile()).resolves.toEqual(DEFAULT_PROFILE);
    await expect(getProfile()).resolves.toMatchObject({ name: "Camille Roux" });
  });

  it("réglages privés (paramètres, assistant) : jamais mis en cache", async () => {
    const { getAssistantConfig, getSettings } = await import("@/lib/server/site-config");
    await getSettings();
    await getSettings();
    await getAssistantConfig();
    expect(r.get).toHaveBeenCalledTimes(3);
    expect(nc.entries.size).toBe(0);
  });
});

describe("site-config — invalidation par les écritures admin", () => {
  it("PUT /api/admin/profile : l'étiquette site:profile est expirée, le nouveau profil est lu", async () => {
    r.store.set("public:profile", { ...DEFAULT_PROFILE, name: "Ancien nom" });
    const { getProfile } = await import("@/lib/server/site-config");
    expect((await getProfile()).name).toBe("Ancien nom"); // mis en cache

    const { PUT } = await import("@/app/api/admin/profile/route");
    const res = await PUT(put("/api/admin/profile", { ...DEFAULT_PROFILE, name: "Nouveau nom" }));
    expect(res.status).toBe(200);

    expect(nc.revalidateTag).toHaveBeenCalledWith("site:profile", { expire: 0 });
    expect((await getProfile()).name).toBe("Nouveau nom");
    expect(r.get).toHaveBeenCalledTimes(2); // relu une fois après l'écriture
  });

  it("PUT /api/admin/settings : l'étiquette site:modules est expirée, le module désactivé est vu", async () => {
    r.store.set("public:modules", { ...DEFAULT_MODULES, chat: true });
    const { getModules, getProfile } = await import("@/lib/server/site-config");
    expect((await getModules()).chat).toBe(true);
    await getProfile(); // autre étiquette : ne doit pas être touchée

    const { PUT } = await import("@/app/api/admin/settings/route");
    const res = await PUT(put("/api/admin/settings", { settings: DEFAULT_SETTINGS, modules: { ...DEFAULT_MODULES, chat: false } }));
    expect(res.status).toBe(200);

    expect(nc.revalidateTag).toHaveBeenCalledWith("site:modules", { expire: 0 });
    expect(nc.revalidateTag).not.toHaveBeenCalledWith("site:profile", expect.anything());
    expect((await getModules()).chat).toBe(false);
    expect([...nc.entries.values()].some((e) => e.tags.includes("site:profile"))).toBe(true);
  });
});
