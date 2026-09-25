import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// QA — brief 1(a). Le brief exige la preuve AUTOMATISÉE que « chaque page
// /admin et chaque route /api/admin » est bloquée côté serveur sans session.
// Pour être exhaustive plutôt qu'à la main, la liste des cibles est GÉNÉRÉE
// depuis l'arborescence app/ : toute page ou route ajoutée plus tard est
// couverte sans rien réécrire.
//
//   1. PAGES /admin : l'UNIQUE layout de app/(admin)/admin garde toutes les
//      pages (contrainte App Router), et il appelle requireAdminPage(), qui
//      lève côté serveur la redirection NEXT_REDIRECT vers /login.
//   2. ROUTES /api/admin/** : appelées sans session, chaque handler
//      GET/POST/PUT/PATCH/DELETE doit répondre 401 {"error":"Non autorisé."},
//      SANS aucune requête base (la base factice lève si un handler s'y
//      connecte → un handler qui tenterait de travailler avant de vérifier
//      la session ferait échouer ce test).

const ROOT = process.cwd();
const ADMIN_PAGES_DIR = path.join(ROOT, "app", "(admin)", "admin");
const ADMIN_API_DIR = path.join(ROOT, "app", "api", "admin");

const m = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; name: string | null; role: string },
  allowDb: false,
}));

vi.mock("@/lib/server/session", () => ({
  getCurrentSession: async () => (m.user && m.allowDb ? { userId: m.user.id, role: m.user.role, email: m.user.email, sessionId: "s" } : null),
}));
vi.mock("@/lib/server/redis", () => ({ getRedis: () => ({}) }));
vi.mock("@/lib/server/site-config", () => ({
  getProfile: async () => ({ name: "Portfolio" }),
  getSettings: async () => ({ siteName: "Portfolio" }),
  getModules: async () => ({ chat: true, booking: true, contact: true }),
  getAssistantConfig: async () => ({}),
  setAssistantConfig: async (config: unknown) => config,
}));
vi.mock("@/lib/server/db", () => {
  const forbidden = () => {
    throw new Error("base touchée sans session : le 401/redirect doit intervenir avant toute requête");
  };
  const chain = () =>
    new Proxy(function () {}, {
      get: () => chain(),
      apply: () => forbidden(),
    });
  const base = {
    user: { findUnique: async () => (m.allowDb ? m.user : forbidden()) },
    $transaction: forbidden,
  };
  return {
    db: new Proxy(base, {
      get: (target, prop) => (prop in target ? (target as Record<string, unknown>)[prop as string] : chain()),
    }),
  };
});

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function apiRouteUrl(file: string): string {
  const segments = path.relative(ADMIN_API_DIR, file).split(path.sep).slice(0, -1); // retire `route.ts`
  return "/api/admin" + (segments.length ? "/" + segments.join("/") : "");
}

beforeEach(() => {
  m.user = null;
  m.allowDb = false;
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.stubEnv("TRUST_PROXY", "true");
  vi.stubEnv("SESSION_SECRET", "s".repeat(48));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("QA 1(a) — PAGES /admin : redirection serveur sans session", () => {
  const pages = walk(ADMIN_PAGES_DIR).filter((f) => f.endsWith("page.tsx"));

  it("chaque page /admin est couverte par l'unique layout admin (aucune échappatoire)", () => {
    const layouts = walk(ADMIN_PAGES_DIR).filter((f) => f.endsWith("layout.tsx"));
    expect(layouts.map((l) => path.relative(ROOT, l).split(path.sep).join("/"))).toEqual(["app/(admin)/admin/layout.tsx"]);
    expect(readFileSync(layouts[0], "utf8")).toContain("requireAdminPage");
    expect(pages.length).toBeGreaterThanOrEqual(10);
  });

  it("sans session, le layout admin lève la redirection serveur NEXT_REDIRECT vers /login", async () => {
    const { default: AdminLayout } = await import("../app/(admin)/admin/layout");
    let thrown: unknown = null;
    try {
      await AdminLayout({ children: null });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    const digest = String((thrown as { digest?: string }).digest ?? "");
    expect(digest).toMatch(/NEXT_REDIRECT/);
    expect(digest).toContain("/login");
  });

  it("avec une session ADMIN en base, le layout administrateur rend (pas de redirection)", async () => {
    m.user = { id: "u1", email: "admin@test.fr", name: "Admin", role: "ADMIN" };
    m.allowDb = true;
    const { default: AdminLayout } = await import("../app/(admin)/admin/layout");
    await expect(AdminLayout({ children: null })).resolves.toBeDefined();
  });
});

describe("QA 1(a) — ROUTES /api/admin : 401 sans session, sans toucher la base", () => {
  it(`chaque handler des routes /api/admin (générées depuis l'arborescence) répond 401`, async () => {
    const files = walk(ADMIN_API_DIR).filter((f) => f.endsWith("route.ts"));
    expect(files.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const file of files) {
      const url = apiRouteUrl(file);
      const spec = "../" + path.relative(ROOT, file).split(path.sep).join("/");
      const mod = (await import(spec)) as Record<string, unknown>;
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
        const handler = mod[method];
        if (typeof handler !== "function") continue;
        try {
          const res = (await (handler as unknown as (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response> | Response)(
            new NextRequest("http://localhost" + url, { method }),
            { params: Promise.resolve({ id: "abc123" }) }
          )) as Response;
          if (res.status !== 401) {
            failures.push(`${url} ${method} → statut ${res.status}`);
            continue;
          }
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!body || body.error !== "Non autorisé.") failures.push(`${url} ${method} → corps ${JSON.stringify(body)}`);
        } catch (err) {
          failures.push(`${url} ${method} → exception ${(err as Error).message}`);
        }
      }
    }
    expect(failures, `routes /api/admin non protégées :\n${failures.join("\n")}`).toEqual([]);
  });
});