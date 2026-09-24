import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeRedis } from "./helpers/fake-redis";

// Messagerie : routes visiteur et admin, avec le vrai jeton signé et le vrai
// module temps réel (Redis simulé). Base en mémoire, avec compteur d'accès
// pour vérifier qu'un poll sans changement ne touche pas PostgreSQL.

type Row = Record<string, unknown> & { id: string; createdAt: Date };

const m = vi.hoisted(() => ({
  redis: null as unknown as ReturnType<typeof import("./helpers/fake-redis").createFakeRedis>,
  tables: { conversations: [] as Row[], messages: [] as Row[], notifications: [] as Row[] },
  dbCalls: 0,
  seq: 0,
  limit: { success: true, reset: 0 },
  limitKeys: [] as string[][],
  admin: null as null | { id: string },
}));

vi.mock("@/lib/server/redis", () => ({ getRedis: () => m.redis }));
vi.mock("@/lib/server/rate-limit", () => ({
  checkLimits: async (checks: [string, string][]) => {
    m.limitKeys.push(checks.map(([rule, key]) => `${rule}:${key}`));
    return m.limit;
  },
  tooManyRequests: () => Response.json({ error: "Trop de tentatives." }, { status: 429, headers: { "retry-after": "30" } }),
}));
vi.mock("@/lib/server/guard", () => ({
  requireAdmin: async () => m.admin,
  requireAdminSession: async () => m.admin,
  unauthorized: () => Response.json({ error: "Non autorisé." }, { status: 401 }),
}));
vi.mock("@/lib/server/db", () => {
  const t = () => m.tables;
  const now = () => new Date(Date.now() + ++m.seq); // horodatages strictement croissants
  const hit = () => void m.dbCalls++;
  const pick = (row: Row, select?: Record<string, boolean>) =>
    select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row;
  const payloadConv = (n: Row) => (n.payload as { conversationId?: string })?.conversationId;
  const client = {
    conversation: {
      create: async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
        hit();
        const row: Row = { ...data, id: `conv${++m.seq}`, createdAt: now(), updatedAt: now() };
        t().conversations.push(row);
        return pick(row, select);
      },
      findUnique: async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
        hit();
        const row = t().conversations.find((c) => c.id === where.id);
        return row ? pick(row, select) : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        hit();
        const row = t().conversations.find((c) => c.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    message: {
      create: async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
        hit();
        const row: Row = { ...data, id: `msg${++m.seq}`, createdAt: now() };
        t().messages.push(row);
        return pick(row, select);
      },
      findFirst: async ({ where }: { where: { id: string; conversationId: string } }) => {
        hit();
        return t().messages.find((x) => x.id === where.id && x.conversationId === where.conversationId) ?? null;
      },
      findMany: async ({ where, orderBy, take, select }: { where: { conversationId: string; createdAt?: { gt: Date } }; orderBy: { createdAt: "asc" | "desc" }[]; take: number; select?: Record<string, boolean> }) => {
        hit();
        const rows = t().messages
          .filter((x) => x.conversationId === where.conversationId && (!where.createdAt || x.createdAt > where.createdAt.gt))
          .sort((a, b) => +a.createdAt - +b.createdAt);
        if (orderBy[0].createdAt === "desc") rows.reverse();
        return rows.slice(0, take).map((r) => pick(r, select));
      },
    },
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        hit();
        const row: Row = { read: false, ...data, id: `notif${++m.seq}`, createdAt: now() };
        t().notifications.push(row);
        return row;
      },
      count: async ({ where }: { where: { read?: boolean; type?: string } }) => {
        hit();
        return t().notifications.filter((n) => (where.read === undefined || n.read === where.read) && (!where.type || n.type === where.type)).length;
      },
      updateMany: async ({ where }: { where: { type: string; read: boolean; payload: { equals: string } } }) => {
        hit();
        const rows = t().notifications.filter((n) => n.type === where.type && n.read === where.read && payloadConv(n) === where.payload.equals);
        rows.forEach((n) => (n.read = true));
        return { count: rows.length };
      },
    },
  };
  return { db: { ...client, $transaction: async (fn: (tx: typeof client) => unknown) => fn(client) } };
});

const SECRET = "s".repeat(48);
const BASE = "http://localhost";
const json = (path: string, body: unknown, cookie?: string) =>
  new NextRequest(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
const get = (path: string, cookie?: string) => new NextRequest(BASE + path, cookie ? { headers: { cookie } } : undefined);
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

const routes = {
  start: () => import("@/app/api/public/conversations/route").then((r) => r.POST),
  current: () => import("@/app/api/public/conversations/current/route").then((r) => r.GET),
  send: () => import("@/app/api/public/conversations/current/messages/route").then((r) => r.POST),
  updates: () => import("@/app/api/admin/updates/route").then((r) => r.GET),
  adminConvs: () => import("@/app/api/admin/conversations/route").then((r) => r.GET),
  markRead: () => import("@/app/api/admin/conversations/[id]/read/route").then((r) => r.POST),
  notifications: () => import("@/app/api/admin/notifications/route"),
};

async function openConversation(content = "Bonjour, une question sur l'audit.", name = "Camille") {
  const res = await (await routes.start())(json("/api/public/conversations", { visitorName: name, content }));
  return { res, cookie: cookieOf(res), body: await res.json() };
}

beforeEach(() => {
  m.redis = createFakeRedis();
  m.tables.conversations.length = 0;
  m.tables.messages.length = 0;
  m.tables.notifications.length = 0;
  m.dbCalls = 0;
  m.limit = { success: true, reset: 0 };
  m.limitKeys.length = 0;
  m.admin = null;
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("visiteur : ouverture et envoi réels", () => {
  it("ouvre une conversation : message + notification, cookie signé HttpOnly/Secure/Lax/30 j", async () => {
    const { res, body } = await openConversation();
    expect(res.status).toBe(201);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^pcs_conv=[^;]+\.[^;]+;/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Max-Age=2592000/i);
    expect(body.messages[0]).toMatchObject({ sender: "VISITOR", content: "Bonjour, une question sur l'audit." });
    expect(m.tables.notifications).toEqual([expect.objectContaining({ type: "message", payload: expect.objectContaining({ name: "Camille" }) })]);
  });

  it("envoie un message dans SA conversation (celle du cookie)", async () => {
    const { cookie } = await openConversation();
    const res = await (await routes.send())(json("/api/public/conversations/current/messages", { content: "Et pour la suite ?" }, cookie));
    expect(res.status).toBe(201);
    const convId = m.tables.conversations[0].id;
    expect(m.tables.messages.filter((x) => x.conversationId === convId)).toHaveLength(2);
    expect(m.tables.notifications).toHaveLength(2);
  });

  it("le contenu est conservé en texte brut (le rendu React l'échappe)", async () => {
    const { body } = await openConversation("<img src=x onerror=alert(1)>");
    expect(body.messages[0].content).toBe("<img src=x onerror=alert(1)>");
  });

  it("validation Zod partagée : message vide ou > 2000 caractères → 400, rien d'écrit", async () => {
    const start = await routes.start();
    expect((await start(json("/api/public/conversations", { content: "   " }))).status).toBe(400);
    expect((await start(json("/api/public/conversations", { content: "a".repeat(2001) }))).status).toBe(400);
    expect(m.tables.messages).toHaveLength(0);
  });

  it("rate limiting : ouverture par IP ; envoi par IP ET par conversation", async () => {
    const { cookie } = await openConversation();
    expect(m.limitKeys[0][0]).toMatch(/^conversationStart:/);
    await (await routes.send())(json("/api/public/conversations/current/messages", { content: "x" }, cookie));
    expect(m.limitKeys[1]).toEqual([expect.stringMatching(/^messageIp:/), `messageConversation:${m.tables.conversations[0].id}`]);

    m.limit = { success: false, reset: Date.now() + 30_000 };
    const res = await (await routes.send())(json("/api/public/conversations/current/messages", { content: "spam" }, cookie));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(m.tables.messages).toHaveLength(2);
  });

  it("incrément Redis best-effort : Redis en panne → le message est quand même enregistré", async () => {
    m.redis.failWrites(true);
    const { res } = await openConversation();
    expect(res.status).toBe(201);
    expect(m.tables.messages).toHaveLength(1);
  });
});

describe("isolement : un visiteur ne lit ni n'écrit jamais chez un autre", () => {
  it("chaque cookie ne donne accès qu'à sa propre conversation", async () => {
    const a = await openConversation("Message de A", "Alice");
    const b = await openConversation("Message de B", "Bob");
    const current = await routes.current();

    const threadA = await (await current(get("/api/public/conversations/current", a.cookie))).json();
    const threadB = await (await current(get("/api/public/conversations/current", b.cookie))).json();
    expect(threadA.messages.map((x: { content: string }) => x.content)).toEqual(["Message de A"]);
    expect(threadB.messages.map((x: { content: string }) => x.content)).toEqual(["Message de B"]);
  });

  it("cookie forgé → aucune conversation ; envoi refusé (404), rien d'écrit", async () => {
    await openConversation();
    const forged = "pcs_conv=eyJjIjoiY29udjEiLCJlIjo5OTk5OTk5OTk5fQ.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    expect(await (await (await routes.current())(get("/api/public/conversations/current", forged))).json()).toEqual({ conversation: null });
    expect((await (await routes.send())(json("/api/public/conversations/current/messages", { content: "intrusion" }, forged))).status).toBe(404);
    expect(m.tables.messages).toHaveLength(1);
  });

  it("cookie d'une autre conversation (identifiant échangé) → refusé", async () => {
    const a = await openConversation("A");
    const b = await openConversation("B");
    const [, sigA] = a.cookie.split("=")[1].split(".");
    const [payloadB] = b.cookie.split("=")[1].split(".");
    const mixed = `pcs_conv=${payloadB}.${sigA}`;
    expect(await (await (await routes.current())(get("/api/public/conversations/current", mixed))).json()).toEqual({ conversation: null });
  });

  it("cookie expiré → refusé", async () => {
    const { createVisitorToken } = await import("@/lib/server/visitor-token");
    await openConversation();
    const expired = `pcs_conv=${createVisitorToken(m.tables.conversations[0].id, Date.now() - 31 * 86_400_000)}`;
    expect(await (await (await routes.current())(get("/api/public/conversations/current", expired))).json()).toEqual({ conversation: null });
  });

  it("le serveur ignore tout identifiant de conversation envoyé par le client", async () => {
    const a = await openConversation("A");
    const b = await openConversation("B");
    const idA = m.tables.conversations[0].id;
    // Champ en trop dans le corps → refusé (.strict).
    expect((await (await routes.send())(json("/api/public/conversations/current/messages", { content: "x", conversationId: idA }, b.cookie))).status).toBe(400);
    // Identifiant en query string → ignoré : le message va dans la conversation du cookie (B).
    const res = await (await routes.send())(json(`/api/public/conversations/current/messages?conversationId=${idA}`, { content: "pour B" }, b.cookie));
    expect(res.status).toBe(201);
    expect(m.tables.messages.filter((x) => x.conversationId === idA).map((x) => x.content)).toEqual(["A"]);
    void a;
  });

  it("un visiteur (même avec son cookie) reçoit 401 sur toutes les routes admin", async () => {
    const { cookie } = await openConversation();
    expect((await (await routes.updates())(get("/api/admin/updates", cookie))).status).toBe(401);
    expect((await (await routes.adminConvs())(get("/api/admin/conversations", cookie))).status).toBe(401);
    const id = m.tables.conversations[0].id;
    expect((await (await routes.markRead())(json(`/api/admin/conversations/${id}/read`, {}, cookie), { params: Promise.resolve({ id }) })).status).toBe(401);
    const { GET, PATCH } = await routes.notifications();
    expect((await GET(get("/api/admin/notifications", cookie))).status).toBe(401);
    expect((await PATCH(new NextRequest(`${BASE}/api/admin/notifications`, { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ all: true }) }))).status).toBe(401);
    expect(m.tables.notifications.every((n) => n.read === false)).toBe(true);
  });
});

describe("polling filtré par Redis", () => {
  it("visiteur : version inchangée → réponse sans aucune requête PostgreSQL", async () => {
    const { cookie } = await openConversation();
    const first = await (await (await routes.current())(get("/api/public/conversations/current", cookie))).json();
    m.dbCalls = 0;
    const again = await (await (await routes.current())(get(`/api/public/conversations/current?since=${first.version}`, cookie))).json();
    expect(again).toEqual({ changed: false, version: first.version });
    expect(m.dbCalls).toBe(0);
  });

  it("visiteur : une réponse de l'admin change la version → seuls les nouveaux messages reviennent", async () => {
    const { cookie } = await openConversation();
    const first = await (await (await routes.current())(get("/api/public/conversations/current", cookie))).json();
    const { bumpConversationVersion } = await import("@/lib/server/realtime");
    m.tables.messages.push({ id: "reply1", conversationId: m.tables.conversations[0].id, sender: "ADMIN", content: "Réponse", createdAt: new Date(Date.now() + 10_000) });
    await bumpConversationVersion(m.tables.conversations[0].id);

    const next = await (await (await routes.current())(get(`/api/public/conversations/current?since=${first.version}&after=${first.messages[0].id}`, cookie))).json();
    expect(next.changed).toBe(true);
    expect(next.messages.map((x: { id: string }) => x.id)).toEqual(["reply1"]);
  });

  it("admin : version inchangée → sans PostgreSQL ; nouveau message → compteurs réels", async () => {
    m.admin = { id: "admin-1" };
    const updates = await routes.updates();
    const v0 = (await (await updates(get("/api/admin/updates"))).json()).version;
    m.dbCalls = 0;
    expect(await (await updates(get(`/api/admin/updates?since=${v0}`))).json()).toEqual({ changed: false, version: v0 });
    expect(m.dbCalls).toBe(0);

    await openConversation();
    const changed = await (await updates(get(`/api/admin/updates?since=${v0}`))).json();
    expect(changed).toMatchObject({ changed: true, unread: { notifications: 1, messages: 1 } });
    expect(changed.version).toBeGreaterThan(v0);
  });

  it("admin : ouvrir une conversation ne marque lus QUE ses messages", async () => {
    await openConversation("A");
    await openConversation("B");
    m.admin = { id: "admin-1" };
    const idA = m.tables.conversations[0].id;
    const res = await (await routes.markRead())(json(`/api/admin/conversations/${idA}/read`, {}), { params: Promise.resolve({ id: idA }) });
    expect(await res.json()).toEqual({ updated: 1 });
    expect(m.tables.notifications.map((n) => n.read)).toEqual([true, false]);
  });
});
