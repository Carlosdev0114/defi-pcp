import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Limite globale de /api/chat, toutes IP confondues. Le vrai module
// lib/server/rate-limit.ts est utilisé (règles, lecture de
// CHAT_GLOBAL_PER_MINUTE, ordre des contrôles dans la route) ; seul le
// moteur Upstash est remplacé par un compteur en mémoire à fenêtre fixe.

const state = vi.hoisted(() => ({
  counts: new Map<string, number>(),
  answer: vi.fn(),
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
      const used = (state.counts.get(id) ?? 0) + 1;
      state.counts.set(id, used);
      return { success: used <= this.tokens, reset: Date.now() + 60_000 };
    }
  }
  return { Ratelimit };
});
vi.mock("@/lib/server/redis", () => ({ getRedis: () => ({}) }));
vi.mock("@/lib/server/rag/chat", () => ({ answerQuestion: state.answer }));

let n = 0;
/** Une IP différente à chaque appel (IP de documentation RFC 5737). */
const freshIp = () => `198.51.100.${++n}`;

function ask(ip: string) {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify({ question: "Quelles technos ?" }),
  });
}

async function statuses(ips: string[]) {
  const { POST } = await import("@/app/api/chat/route");
  const out: number[] = [];
  for (const ip of ips) out.push((await POST(ask(ip))).status);
  return out;
}

beforeEach(() => {
  state.counts.clear();
  (globalThis as { limiters?: unknown }).limiters = undefined; // relit CHAT_GLOBAL_PER_MINUTE
  state.answer.mockReset().mockResolvedValue({ status: "ok", result: { answer: "ok", sources: [] } });
  vi.stubEnv("TRUST_PROXY", "true");
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.stubEnv("CHAT_GLOBAL_PER_MINUTE", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/chat — limite globale (toutes IP)", () => {
  it("8 questions/min par défaut : la 9ᵉ, d'une IP neuve, reçoit le même 503 que le quota Gemini", async () => {
    const ips = Array.from({ length: 9 }, freshIp);
    const codes = await statuses(ips.slice(0, 8));
    expect(codes).toEqual(Array(8).fill(200));

    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(ask(ips[8]));
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ error: "L'assistant est très sollicité, réessayez dans une minute." });
    expect(body).not.toMatch(/gemini|quota|429|global|limite/i);

    // Gemini n'a été sollicité que pour les 8 requêtes admises.
    expect(state.answer).toHaveBeenCalledTimes(8);
  });

  it("des IP changeantes ne contournent pas la limite globale", async () => {
    const codes = await statuses(Array.from({ length: 20 }, freshIp));
    expect(codes.filter((c) => c === 200)).toHaveLength(8);
    expect(codes.slice(8).every((c) => c === 503)).toBe(true);
    expect(state.answer).toHaveBeenCalledTimes(8);
  });

  it("une requête refusée par la limite par IP ne consomme pas le budget global", async () => {
    // Une même IP : 5 admises (chatBurst = 5 / 30 s), puis 2 refusées en 429.
    const sameIp = freshIp();
    expect(await statuses(Array(7).fill(sameIp))).toEqual([200, 200, 200, 200, 200, 429, 429]);
    // Le budget global a consommé 5 (et non 7) : il reste donc 3 places.
    expect(await statuses(Array.from({ length: 4 }, freshIp))).toEqual([200, 200, 200, 503]);
  });

  it("CHAT_GLOBAL_PER_MINUTE règle la limite", async () => {
    vi.stubEnv("CHAT_GLOBAL_PER_MINUTE", "3");
    expect(await statuses(Array.from({ length: 5 }, freshIp))).toEqual([200, 200, 200, 503, 503]);
  });

  it("valeur invalide → défaut 8", async () => {
    vi.stubEnv("CHAT_GLOBAL_PER_MINUTE", "beaucoup");
    const codes = await statuses(Array.from({ length: 9 }, freshIp));
    expect(codes.filter((c) => c === 200)).toHaveLength(8);
  });
});
