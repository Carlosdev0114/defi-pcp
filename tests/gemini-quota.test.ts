import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Chemin testé : Gemini répond HTTP 429 (quota) → GeminiQuotaError levée par
// le vrai client (lib/server/rag/gemini.ts) → traduite en 503 par les routes.
// Seule l'infrastructure est simulée (Redis, base, rate limiting, session) ;
// l'appel réseau vers Google est intercepté par un faux `fetch`.
// Aucun appel réel n'est émis.

const mocks = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const redis = {
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    set: async (k: string, v: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(k)) return null;
      store.set(k, v);
      return "OK";
    },
    del: async (...keys: string[]) => keys.filter((k) => store.delete(k)).length,
    hset: async (k: string, fields: Record<string, unknown>) => {
      store.set(k, { ...((store.get(k) as object) ?? {}), ...fields });
      return Object.keys(fields).length;
    },
    hgetall: async (k: string) => (store.get(k) as Record<string, unknown>) ?? null,
    incr: async (k: string) => {
      const n = Number(store.get(k) ?? 0) + 1;
      store.set(k, n);
      return n;
    },
  };
  const findMany = async () => [];
  const db = {
    project: { findMany },
    experience: { findMany },
    skill: { findMany },
    article: { findMany },
    service: { findMany },
    activity: { create: vi.fn() },
  };
  return { store, redis, db, requireAdmin: vi.fn() };
});

vi.mock("@/lib/server/redis", () => ({ getRedis: () => mocks.redis }));
vi.mock("@/lib/server/db", () => ({ db: mocks.db }));
vi.mock("@/lib/server/rate-limit", () => ({
  checkLimits: async () => ({ success: true, reset: 0 }),
  CHAT_GLOBAL_KEY: "all",
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/server/guard", () => ({
  requireAdmin: mocks.requireAdmin,
  unauthorized: () => Response.json({ error: "Non autorisé." }, { status: 401 }),
}));

// Corps réaliste renvoyé par Google en cas de quota dépassé : il contient
// exactement le genre de détails internes qui ne doivent jamais fuiter.
const GOOGLE_429_BODY = JSON.stringify({
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    message:
      "You exceeded your current quota, please check your plan and billing details. " +
      "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, " +
      "limit: 10, model: gemini-2.5-flash",
  },
});

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.startsWith("https://generativelanguage.googleapis.com/")) {
    return new Response(GOOGLE_429_BODY, { status: 429, headers: { "content-type": "application/json" } });
  }
  throw new Error(`Appel réseau inattendu dans le test : ${url}`);
});

/** Index RAG déjà construit : une question déclenche l'embedding de la
 * requête, donc un appel Gemini. */
function seedRagIndex() {
  const emb = Buffer.from(new Float32Array(768).fill(0.1).buffer).toString("base64");
  mocks.store.set("rag:meta", { buildId: "b1", builtAt: "2026-09-24T00:00:00Z", count: 1, model: "m", dims: 768 });
  mocks.store.set("rag:chunks:b1", {
    "profil#0": { source: "profil", title: "Profil", text: "Profil de test", emb },
  });
}

function jsonRequest(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: "POST",
    // IP de documentation (RFC 5737), lue car TRUST_PROXY=true dans beforeEach.
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.10" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Tout ce que le client reçoit : statut, en-têtes et corps brut. */
async function visibleToClient(res: Response) {
  const headers = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
  const body = await res.text();
  return { body, everything: `${headers}\n${body}` };
}

beforeEach(() => {
  mocks.store.clear();
  (globalThis as { ragMemo?: unknown }).ragMemo = undefined;
  fetchMock.mockClear();
  mocks.requireAdmin.mockReset();
  mocks.db.activity.create.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.stubEnv("TRUST_PROXY", "true");
  // Les routes journalisent l'incident côté serveur : on le vérifie sans
  // polluer la sortie des tests.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/chat — quota Gemini dépassé (429)", () => {
  it("répond 503 + Retry-After: 60 + message « assistant très sollicité »", async () => {
    seedRagIndex();
    const { POST } = await import("@/app/api/chat/route");

    const res = await POST(jsonRequest("http://localhost/api/chat", { question: "Quelles technos ?" }));

    // Le chemin a réellement été emprunté : Gemini a été appelé et a renvoyé 429.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(":embedContent");

    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(res.headers.get("content-type")).toContain("application/json");

    const payload = await res.clone().json();
    // Contrat pour le frontend : même forme que toutes les erreurs de l'API.
    expect(Object.keys(payload)).toEqual(["error"]);
    expect(typeof payload.error).toBe("string");
    expect(payload.error).toContain("assistant est très sollicité");

    expect(console.warn).toHaveBeenCalled();
  });

  it("ne laisse fuiter aucun détail interne (Gemini, quota, 429, stack)", async () => {
    seedRagIndex();
    const { POST } = await import("@/app/api/chat/route");

    const res = await POST(jsonRequest("http://localhost/api/chat", { question: "Quelles technos ?" }));
    const { everything } = await visibleToClient(res);

    expect(res.status).toBe(503);
    expect(everything).not.toMatch(/gemini/i);
    expect(everything).not.toMatch(/quota/i);
    expect(everything).not.toMatch(/429/);
    expect(everything).not.toMatch(/googleapis|RESOURCE_EXHAUSTED|billing/i);
    // Traces de pile : « Error: … » ou lignes « at fonction (fichier:ligne) ».
    expect(everything).not.toMatch(/\bError\b|\bstack\b|\n\s*at\s|\.ts:\d+/);
  });
});

describe("POST /api/admin/assistant — quota Gemini dépassé (429)", () => {
  it("admin connecté : 503 + Retry-After: 60 + message admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.example", name: "Admin" });
    const { POST } = await import("@/app/api/admin/assistant/route");

    const res = await POST();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(":batchEmbedContents");

    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ error: "Quota Gemini atteint, réessayez dans une minute." });

    // Pas d'audit d'une reconstruction qui n'a pas eu lieu, et verrou libéré.
    expect(mocks.db.activity.create).not.toHaveBeenCalled();
    expect(mocks.store.has("rag:lock")).toBe(false);
  });

  it("sans session admin : 401, jamais le message de quota (et aucun appel Gemini)", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/assistant/route");

    const res = await POST();
    const { everything } = await visibleToClient(res);

    expect(res.status).toBe(401);
    expect(res.headers.get("retry-after")).toBeNull();
    expect(JSON.parse(everything.slice(everything.indexOf("{")))).toEqual({ error: "Non autorisé." });
    expect(everything).not.toMatch(/quota/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
