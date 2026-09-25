import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// QA — brief 1(e). Le brief exige la preuve AUTOMATISÉE que login, chat,
// contact, booking, messages et visit renvoient 429 (ou 503) avec
// retry-after, AUX BONS SEUILS définis dans lib/server/rate-limit.ts.
//
// Le VRAI module rate-limit est chargé (règles réelles, ordre des contrôles,
// calcul du retry-after) ; seul le moteur Upstash est remplacé par un
// compteur en mémoire à fenêtre fixe (même approche que
// tests/chat-global-limit.test.ts pour /api/chat).
//
// ⚠ Écart constaté à SIGNALER au rapport : /api/public/visit dépasse sa
// limite globalement (600/min) mais répond 204 SILENCIEUX, pas 429/503.

const st = vi.hoisted(() => ({
  used: new Map<string, number>(),
  recordVisit: vi.fn(),
}));

const dbstate = vi.hoisted(() => ({
  txRows: {} as Record<string, Array<Record<string, unknown>>>,
  txResult: { refused: "taken" } as unknown,
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow(tokens: number, window: string) {
      return { tokens, window };
    }
    private tokens: number;
    private prefix: string;
    constructor(opts: { limiter: { tokens: number }; prefix: string }) {
      this.tokens = opts.limiter.tokens;
      this.prefix = opts.prefix;
    }
    async limit(key: string) {
      const id = `${this.prefix}:${key}`;
      const used = (st.used.get(id) ?? 0) + 1;
      st.used.set(id, used);
      return { success: used <= this.tokens, reset: Date.now() + 60_000 };
    }
  }
  return { Ratelimit };
});
vi.mock("@/lib/server/redis", () => ({ getRedis: () => ({}) }));
vi.mock("@/lib/server/db", () => {
  const insert =
    (table: string) =>
    async ({ data }: { data: Record<string, unknown> }) => {
      const rows = (dbstate.txRows[table] ??= []);
      rows.push({ id: `id${rows.length + 1}`, ...data });
      return rows[rows.length - 1];
    };
  const tx = {
    contact: { create: insert("contacts") },
    lead: { create: insert("leads") },
    leadEvent: { create: insert("events") },
    notification: { create: insert("notifications") },
    conversation: {
      create: async () => ({ id: "conv1", visitorName: null }),
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...data }),
      findUnique: async () => ({ id: "conv1", visitorName: "Visiteur" }),
    },
    message: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "m1", sender: data.sender, content: data.content, createdAt: new Date(0) }),
    },
  };
  return {
    db: {
      user: { findUnique: async () => null },
      ...tx,
      $transaction: async (work: unknown, opts?: { isolationLevel?: unknown }) =>
        opts?.isolationLevel
          ? dbstate.txResult
          : typeof work === "function"
            ? (work as (txClient: typeof tx) => Promise<unknown>)(tx)
            : dbstate.txResult,
    },
  };
});
vi.mock("@/lib/server/realtime", () => ({
  bumpAdminVersion: async () => {},
  bumpConversationVersion: async () => {},
  getAdminVersion: async () => 0,
  getConversationVersion: async () => 0,
}));
vi.mock("@/lib/server/audit", () => ({ notify: async () => {}, logActivity: async () => {} }));
vi.mock("@/lib/server/cache", () => ({
  cached: async (_ns: string, _key: string, fn: () => unknown) => fn(),
  invalidate: async () => {},
}));
vi.mock("@/lib/server/site-config", () => ({
  getModules: async () => ({ booking: true, chat: true, contact: true }),
  getProfile: async () => ({ name: "Portfolio" }),
  getSettings: async () => ({ siteName: "Portfolio" }),
  getAssistantConfig: async () => ({}),
}));
vi.mock("bcryptjs", () => ({
  compare: async () => false,
  hashSync: () => "hash-factice",
}));
vi.mock("@/lib/server/visits", () => ({
  knownPath: async () => "/",
  isBot: () => false,
  recordVisit: st.recordVisit,
}));

const BASE = "http://localhost";
const SECRET = "s".repeat(48);

const jsonPost = (path: string, body: unknown, ip: string, extra?: { cookie?: string }) =>
  new NextRequest(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip, ...(extra?.cookie ? { cookie: extra.cookie } : {}) },
    body: JSON.stringify(body),
  });

const loginBody = (email: string) => ({ email, password: "mot-de-passe-8" });

beforeEach(() => {
  st.used.clear();
  Object.keys(dbstate.txRows).forEach((k) => delete dbstate.txRows[k]);
  dbstate.txResult = { refused: "taken" };
  st.recordVisit.mockClear();
  (globalThis as { limiters?: unknown }).limiters = undefined;
  vi.stubEnv("TRUST_PROXY", "true");
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const codes = async (reqs: NextRequest[], route: () => Promise<{ POST: (req: NextRequest) => Promise<Response> | Response }>) => {
  const { POST } = await route();
  const out: number[] = [];
  for (const req of reqs) out.push((await POST(req)).status);
  return out;
};

describe("QA 1(e) — /api/auth/login : par IP puis par e-mail", () => {
  it("20 tentatives/IP admises, la 21ᵉ (même IP) → 429 + retry-after", async () => {
    const ip = "198.51.100.10";
    const reqs = Array.from({ length: 21 }, (_, i) => jsonPost("/api/auth/login", loginBody(`u${i}@test.fr`), ip));
    const statuses = await codes(reqs, () => import("@/app/api/auth/login/route"));
    expect(statuses.slice(0, 20)).toEqual(new Array(20).fill(401));
    expect(statuses[20]).toBe(429);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(jsonPost("/api/auth/login", loginBody("u99@test.fr"), ip));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("5 tentatives/e-mail admises (IP différentes), la 6ᵉ → 429 + retry-after", async () => {
    const reqs = Array.from({ length: 6 }, (_, i) => jsonPost("/api/auth/login", loginBody("cible@test.fr"), `198.51.100.${200 + i}`));
    const statuses = await codes(reqs, () => import("@/app/api/auth/login/route"));
    expect(statuses.slice(0, 5)).toEqual(new Array(5).fill(401));
    expect(statuses[5]).toBe(429);
  });
});

describe("QA 1(e) — /api/contact : 3 envois/IP admis, le 4ᵉ → 429 + retry-after", () => {
  it("3 × 201 puis 429 avec retry-after", async () => {
    const ip = "198.51.100.20";
    const body = { name: "Camille Dupont", email: "camille@example.fr", subject: "Refonte", message: "Bonjour, un projet de refonte à discuter." };
    const reqs = Array.from({ length: 4 }, () => jsonPost("/api/contact", body, ip));
    const statuses = await codes(reqs, () => import("@/app/api/contact/route"));
    expect(statuses.slice(0, 3)).toEqual(new Array(3).fill(201));
    expect(statuses[3]).toBe(429);
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(jsonPost("/api/contact", body, ip));
    expect(res.headers.get("retry-after")).toBe("60");
  });
});

describe("QA 1(e) — /api/appointments : 5 réservations/IP admises, la 6ᵉ → 429 + retry-after", () => {
  it("5 × 409 (créneau pris simulé) puis 429", async () => {
    const ip = "198.51.100.30";
    const body = {
      serviceId: "s1",
      startAt: new Date(Date.now() + 3_600_000).toISOString(),
      visitorName: "Camille Dupont",
      visitorEmail: "camille@example.fr",
    };
    const reqs = Array.from({ length: 6 }, () => jsonPost("/api/appointments", body, ip));
    const statuses = await codes(reqs, () => import("@/app/api/appointments/route"));
    expect(statuses.slice(0, 5)).toEqual(new Array(5).fill(409));
    expect(statuses[5]).toBe(429);
  });

  it("le 429 porte Retry-After", async () => {
    const ip = "198.51.100.31";
    const body = { serviceId: "s1", startAt: new Date(Date.now() + 3_600_000).toISOString(), visitorName: "Camille Dupont", visitorEmail: "camille@example.fr" };
    const { POST } = await import("@/app/api/appointments/route");
    for (let i = 0; i < 5; i++) await POST(jsonPost("/api/appointments", body, ip));
    const res = await POST(jsonPost("/api/appointments", body, ip));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });
});

describe("QA 1(e) — messagerie visiteur : ouverture par IP, envoi par IP", () => {
  it("3 ouvertures/IP admises, la 4ᵉ → 429 (conversationStart = 3 / h)", async () => {
    const ip = "198.51.100.40";
    const reqs = Array.from({ length: 4 }, () => jsonPost("/api/public/conversations", { content: "Bonjour" }, ip));
    const statuses = await codes(reqs, () => import("@/app/api/public/conversations/route"));
    expect(statuses.slice(0, 3)).toEqual(new Array(3).fill(201));
    expect(statuses[3]).toBe(429);
  });

  it("10 messages/IP admis, le 11ᵉ → 429 (messageIp = 10 / min), avec retry-after", async () => {
    const ip = "198.51.100.41";
    const { createVisitorToken, VISITOR_COOKIE } = await import("@/lib/server/visitor-token");
    const cookie = `${VISITOR_COOKIE}=${createVisitorToken("conv1")}`;
    const reqs = Array.from({ length: 11 }, () => jsonPost("/api/public/conversations/current/messages", { content: "Bonjour" }, ip, { cookie }));
    const statuses = await codes(reqs, () => import("@/app/api/public/conversations/current/messages/route"));
    expect(statuses.slice(0, 10)).toEqual(new Array(10).fill(201));
    expect(statuses[10]).toBe(429);
  });

  it("le quota par CONVERSATION (30 / 10 min) agit aussi quand l'IP change", async () => {
    // Chaque message vient d'une IP neuve : seul messageConversation (30) peut
    // bloquer → le 31ᵉ message de LA MÊME conversation est refusé en 429.
    const { createVisitorToken, VISITOR_COOKIE } = await import("@/lib/server/visitor-token");
    const cookie = `${VISITOR_COOKIE}=${createVisitorToken("conv1")}`;
    const { POST } = await import("@/app/api/public/conversations/current/messages/route");
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await POST(jsonPost("/api/public/conversations/current/messages", { content: "Bonjour" }, `198.51.100.${100 + i}`, { cookie }))).status);
    expect(statuses.slice(0, 30).every((s) => s === 201)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});

describe("QA 1(e) — /api/public/visit : plafond GLOBAL tamponné (écart assumé)", () => {
  it("600 pages vues/min comptées, puis réponses 204 SILENCIEUSES — pas 429", async () => {
    const { POST } = await import("@/app/api/public/visit/route");
    const statuses: number[] = [];
    for (let i = 0; i < 601; i++) {
      const res = await POST(jsonPost("/api/public/visit", { path: "/" }, "198.51.100.50"));
      statuses.push(res.status);
    }
    // Les 600 premières sont comptées, la 601ᵉ ne compte plus.
    expect(statuses.every((s) => s === 204)).toBe(true);
    expect(st.recordVisit).toHaveBeenCalledTimes(600);
    // ÉCART vs brief : le brief attend 429/503 + retry-after ; la route répond
    // 204 silencieux (anti-robot assumé : ne rien apprendre au robot). À
    // trancher en revue — ce test fige le comportement ACTUEL.
    const res = await POST(jsonPost("/api/public/visit", { path: "/" }, "198.51.100.50"));
    expect(res.headers.get("retry-after")).toBeNull();
  });
});