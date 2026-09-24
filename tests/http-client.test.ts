import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RETRY_SECONDS, NETWORK_ERROR, parseRetryAfter, requestJson } from "@/lib/http/client";
import { askAssistant, remainingSeconds } from "@/lib/chat/client";

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } }));

afterEach(() => vi.unstubAllGlobals());

describe("parseRetryAfter", () => {
  it("lit un nombre de secondes", () => {
    expect(parseRetryAfter("60")).toBe(60);
    expect(parseRetryAfter(" 12 ")).toBe(12);
  });

  it("lit une date HTTP", () => {
    const now = Date.parse("2026-09-24T10:00:00Z");
    expect(parseRetryAfter("Thu, 24 Sep 2026 10:00:30 GMT", now)).toBe(30);
  });

  it("borne à [1, 3600]", () => {
    expect(parseRetryAfter("0")).toBe(1);
    expect(parseRetryAfter("999999")).toBe(3600);
    expect(parseRetryAfter("Thu, 01 Jan 2020 00:00:00 GMT")).toBe(1);
  });

  it("null si absent ou illisible", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("bientôt")).toBeNull();
    expect(parseRetryAfter("-5")).toBeNull();
  });
});

describe("askAssistant — contrat de POST /api/chat", () => {
  it("200 → réponse texte et sources", async () => {
    vi.stubGlobal("fetch", reply(200, { answer: "<b>Next.js</b>", sources: ["Profil"] }));
    expect(await askAssistant("Quelles technos ?")).toEqual({ kind: "answer", answer: "<b>Next.js</b>", sources: ["Profil"] });
  });

  it("503 + Retry-After: 60 → attente de 60 s avec le message de l'API", async () => {
    vi.stubGlobal("fetch", reply(503, { error: "L'assistant est très sollicité, réessayez dans une minute." }, { "retry-after": "60" }));
    expect(await askAssistant("x")).toEqual({
      kind: "wait",
      error: "L'assistant est très sollicité, réessayez dans une minute.",
      retryAfter: 60,
    });
  });

  it("429 + Retry-After: 12 → attente de 12 s", async () => {
    vi.stubGlobal("fetch", reply(429, { error: "Trop de tentatives. Réessayez dans 12 s." }, { "retry-after": "12" }));
    const outcome = await askAssistant("x");
    expect(outcome).toMatchObject({ kind: "wait", retryAfter: 12 });
  });

  it("503 sans Retry-After → délai par défaut", async () => {
    vi.stubGlobal("fetch", reply(503, { error: "Indisponible." }));
    expect(await askAssistant("x")).toMatchObject({ kind: "wait", retryAfter: DEFAULT_RETRY_SECONDS });
  });

  it("erreur réseau → message dédié, sans exception", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await askAssistant("x")).toEqual({ kind: "error", error: NETWORK_ERROR });
  });

  it("400 / 500 → erreur simple, pas d'attente", async () => {
    vi.stubGlobal("fetch", reply(400, { error: "Entrées invalides." }));
    expect(await askAssistant("x")).toEqual({ kind: "error", error: "Entrées invalides." });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>oups</html>", { status: 500 })));
    expect(await askAssistant("x")).toMatchObject({ kind: "error" });
  });
});

describe("requestJson", () => {
  it("n'expose jamais un corps non JSON comme message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<h1>Stack trace…</h1>", { status: 502 })));
    const r = await requestJson("/x");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).not.toContain("Stack");
  });
});

describe("remainingSeconds (compte à rebours)", () => {
  it("arrondit à la seconde supérieure et s'arrête à 0", () => {
    expect(remainingSeconds(null, 1000)).toBe(0);
    expect(remainingSeconds(61_000, 1000)).toBe(60);
    expect(remainingSeconds(1500, 1000)).toBe(1);
    expect(remainingSeconds(1000, 5000)).toBe(0);
  });
});
