import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig from "@/next.config";
import { buildCsp, generateNonce, isNonceRoute } from "@/lib/csp";

// CSP : pages publiques = en-tête statique de next.config ('unsafe-inline',
// sans nonce) ; /admin et /login = en-tête posé par proxy.ts (nonce neuf à
// chaque requête + 'strict-dynamic', sans 'unsafe-inline').

const session = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("@/lib/server/session-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/session-core")>()),
  verifySession: session.verify,
}));

const scriptSrc = (csp: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) ?? "";
const nonceOf = (csp: string) => scriptSrc(csp).match(/'nonce-([^']+)'/)?.[1] ?? null;

/** En-têtes que Next appliquerait via next.config pour ce chemin (même
 * algorithme de correspondance des `source` que Next). */
async function configCspFor(pathname: string): Promise<string[]> {
  const rules = (await nextConfig.headers?.()) ?? [];
  return rules
    .filter((rule) => getPathMatch(rule.source, { removeUnnamedParams: true, strict: true })(pathname) !== false)
    .flatMap((rule) => rule.headers)
    .filter((h) => h.key.toLowerCase() === "content-security-policy")
    .map((h) => h.value);
}

async function proxyFor(pathname: string, cookie?: string) {
  const { default: proxy } = await import("@/proxy");
  const req = new NextRequest(`http://localhost${pathname}`, cookie ? { headers: { cookie } } : undefined);
  return proxy(req);
}

beforeEach(() => {
  session.verify.mockReset().mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("CSP des routes publiques (next.config, statique)", () => {
  it.each(["/", "/projets", "/articles/notation-et-recette", "/contact", "/administration", "/loginx"])(
    "%s : un seul en-tête CSP, 'unsafe-inline', pas de nonce",
    async (path) => {
      const csps = await configCspFor(path);
      expect(csps).toHaveLength(1);
      expect(scriptSrc(csps[0])).toContain("'unsafe-inline'");
      expect(csps[0]).not.toContain("nonce-");
      expect(csps[0]).not.toContain("strict-dynamic");
    }
  );

  it("le proxy n'ajoute aucune CSP sur une page publique (elle reste statique)", async () => {
    const res = await proxyFor("/projets");
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-nonce")).toBeNull();
  });

  it("durcissements présents dans la CSP publique", async () => {
    const [csp] = await configCspFor("/");
    for (const directive of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "connect-src 'self'"]) {
      expect(csp).toContain(directive);
    }
  });
});

describe("CSP de /admin et /login (proxy.ts, nonce par requête)", () => {
  it.each(["/admin", "/admin/leads", "/login"])("%s : next.config n'ajoute pas de seconde CSP", async (path) => {
    expect(await configCspFor(path)).toEqual([]);
  });

  it("/login : nonce + 'strict-dynamic', sans 'unsafe-inline'", async () => {
    const res = await proxyFor("/login");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(nonceOf(csp)).toMatch(/^[A-Za-z0-9+/]{22}==$/); // 128 bits en base64
    expect(scriptSrc(csp)).toContain("'strict-dynamic'");
    expect(scriptSrc(csp)).not.toContain("'unsafe-inline'");
    // Next lit le nonce dans la CSP de la REQUÊTE : même nonce transmis.
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(csp));
    expect(nonceOf(res.headers.get("x-middleware-request-content-security-policy") ?? "")).toBe(nonceOf(csp));
  });

  it("/admin (session admin) : nonce + 'strict-dynamic', sans 'unsafe-inline'", async () => {
    session.verify.mockResolvedValue({ sessionId: "s", userId: "u", role: "ADMIN", email: "a@b.c", name: "A" });
    const res = await proxyFor("/admin/leads", "pcs_session=jeton");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(res.status).toBe(200);
    expect(nonceOf(csp)).not.toBeNull();
    expect(scriptSrc(csp)).toContain("'strict-dynamic'");
    expect(scriptSrc(csp)).not.toContain("'unsafe-inline'");
  });

  it("nonce différent à chaque requête", async () => {
    const nonces = new Set<string | null>();
    for (let i = 0; i < 20; i++) {
      nonces.add(nonceOf((await proxyFor("/login")).headers.get("content-security-policy") ?? ""));
    }
    expect(nonces.has(null)).toBe(false);
    expect(nonces.size).toBe(20);
  });

  it("/admin sans session : redirection vers /login (aucune page rendue)", async () => {
    const res = await proxyFor("/admin");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?next=%2Fadmin");
  });
});

describe("lib/csp", () => {
  it("variante stricte : jamais 'unsafe-inline' dans script-src, 'unsafe-eval' seulement en dev", () => {
    const prod = buildCsp({ isDev: false, blobImages: false, nonce: "abc" });
    const dev = buildCsp({ isDev: true, blobImages: false, nonce: "abc" });
    expect(scriptSrc(prod)).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(scriptSrc(dev)).toContain("'unsafe-eval'");
    expect(scriptSrc(dev)).not.toContain("'unsafe-inline'");
    expect(buildCsp({ isDev: false, blobImages: false })).not.toContain("unsafe-eval");
  });

  it("isNonceRoute couvre /admin, /login et leurs sous-routes seulement", () => {
    expect(["/admin", "/admin/", "/admin/leads", "/login", "/login/x"].every(isNonceRoute)).toBe(true);
    expect(["/", "/administration", "/loginx", "/api/admin/leads"].some(isNonceRoute)).toBe(false);
  });

  it("generateNonce : 128 bits, jamais répété", () => {
    const all = new Set(Array.from({ length: 1000 }, generateNonce));
    expect(all.size).toBe(1000);
    expect(Buffer.from([...all][0], "base64")).toHaveLength(16);
  });
});
