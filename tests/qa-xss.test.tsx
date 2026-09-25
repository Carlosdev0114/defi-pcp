import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Markdown } from "@/components/content/Markdown";

// QA — brief 1(b). XSS par les champs contact, messages, articles, projets
// et notes CRM : « relus en public ET en admin : jamais interprétés ».
//
// Preuves :
//   1. envoi RÉEL de charges malveillantes via POST /api/contact et
//      POST /api/admin/leads/[id]/notes → stockées en TEXTE BRUT (aucun
//      filtre qui déforme), puis prouvé que le rendu public (Markdown) et le
//      rendu React (texte / defaultValue) n'émettent aucune balise, attribut
//      ni URL javascript: actifs ;
//   2. le rendu Markdown réel (react-markdown + skipHtml + urlTransform
//      safeUrl) désarme chaque charge (complément de tests/markdown.test.tsx) ;
//   3. les messages visiteur sont déjà couverts par
//      tests/messaging-api.test.ts (« le contenu est conservé en texte brut ») ;
//   4. scan FS : aucun dangerouslySetInnerHTML sous app/ components/ lib/ ;
//   5. les pages publiques de détail (articles/projets, [slug]) passent leur
//      contenu dans <Markdown> — pas de rendu HTML brut.

const ROOT = process.cwd();

const SCRIPT = "<script>alert(1)</script>";
const ONERROR = "<img src=x onerror=alert(1)>";
const JS_URL = "[cliquez](javascript:alert(1))";
const ATTR = "\"><script>alert(1)</script>";

const rows = vi.hoisted(() => ({
  contacts: [] as Array<Record<string, unknown>>,
  notes: [] as Array<Record<string, unknown>>,
  admin: false,
}));

vi.mock("@/lib/server/session", () => ({
  getCurrentSession: async () => (rows.admin ? { userId: "u1", role: "ADMIN", email: "admin@test.fr", sessionId: "s" } : null),
}));
vi.mock("@/lib/server/redis", () => ({ getRedis: () => ({}) }));
vi.mock("@/lib/server/rate-limit", () => ({
  checkLimits: async () => ({ success: true, reset: 0 }),
  tooManyRequests: () => new NextResponse(null, { status: 429 }),
}));
vi.mock("@/lib/server/realtime", () => ({
  bumpAdminVersion: async () => {},
  bumpConversationVersion: async () => {},
  getAdminVersion: async () => 0,
  getConversationVersion: async () => 0,
}));
vi.mock("@/lib/server/audit", () => ({ notify: async () => {}, logActivity: async () => {} }));
vi.mock("@/lib/server/db", () => {
  const tx = {
    contact: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const r = { id: "c1", ...data };
        rows.contacts.push(r);
        return r;
      },
    },
    lead: {
      create: async () => ({ id: "l1" }),
      update: async () => ({}),
    },
    leadEvent: { create: async () => ({ id: "e1" }) },
    notification: { create: async () => ({ id: "n1" }) },
    leadNote: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const r = { id: "note1", ...data };
        rows.notes.push(r);
        return r;
      },
    },
    activity: { create: async () => ({ id: "a1" }) },
  };
  return {
    db: {
      user: {
        findUnique: async () =>
          rows.admin ? { id: "u1", email: "admin@test.fr", name: "Admin", role: "ADMIN" } : null,
      },
      ...tx,
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

const mdHtml = (s: string) => renderToStaticMarkup(<Markdown>{s}</Markdown>);
const textHtml = (s: string) => renderToStaticMarkup(<p>{s}</p>);
const inputHtml = (s: string) => renderToStaticMarkup(<input defaultValue={s} />);
const textareaHtml = (s: string) => renderToStaticMarkup(<textarea defaultValue={s} />);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

beforeEach(() => {
  rows.contacts.length = 0;
  rows.notes.length = 0;
  rows.admin = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QA 1(b) — charges XSS : le rendu ne produit JAMAIS de HTML actif", () => {
  it.each([
    ["balise <script>", SCRIPT, /<script|<\/script/i],
    ["événement onerror", ONERROR, /\bonerror/i],
    ["URL javascript:", JS_URL, /javascript:/i],
    ["injection d'attribut", ATTR, /"><script/i],
  ])("%s dans un rendu Markdown public → neutralisée", (_label, payload, activePattern) => {
    const html = mdHtml(payload);
    expect(html).not.toMatch(activePattern);
    expect(html).not.toMatch(/<script/i);
  });

  it("charge injectée dans un contexte d'attribut (defaultValue) → échappée par React", () => {
    const html = inputHtml(ATTR);
    expect(html).not.toMatch(/>"/); // plus aucun `"` nu sortant de l'attribut
    expect(html).toContain("&quot;");
    expect(html).not.toMatch(/<script/i);
  });
});

describe("QA 1(b) — contact : envoi réel, stockage brut, relecture publique inoffensive", () => {
  it("script + onerror + javascript: stockés tels quels, jamais interprétés en rendu", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(
      new NextRequest("http://localhost/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: SCRIPT, email: "camille@example.fr", subject: ONERROR, message: JS_URL }),
      })
    );
    expect(res.status).toBe(201);
    expect(rows.contacts).toHaveLength(1);

    const stored = rows.contacts[0];
    // Stockage fidèle : rien n'est filtré ni encodé lors de l'écriture.
    expect(stored.name).toBe(SCRIPT);
    const message = String(stored.message);
    expect(message).toContain(ONERROR);
    expect(message).toContain(JS_URL);

    // Relecture publique : le Markdown (skipHtml + urlTransform) désarme.
    const md = mdHtml(message);
    expect(md).not.toMatch(/onerror/i);
    expect(md).not.toMatch(/javascript:/i);
    expect(md).not.toMatch(/<script/i);

    // Relecture admin : React échappe le texte (nom + sujet + corps).
    const text = textHtml(String(stored.name) + " " + message);
    expect(text).not.toContain("<script");
    expect(text).not.toContain("<img");
  });
});

describe("QA 1(b) — notes CRM : envoi réel côté admin, stockage brut, affichage échappé", () => {
  it("note malveillante → stockée telle quelle, rendue en texte (text/textarea) échappé", async () => {
    rows.admin = true;
    const payload = `${SCRIPT} ${ATTR}`;
    const { POST } = await import("@/app/api/admin/leads/[id]/notes/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/leads/l1/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: payload }),
      }),
      { params: Promise.resolve({ id: "l1" }) }
    );
    expect(res.status).toBe(201);
    expect(rows.notes).toHaveLength(1);
    expect(rows.notes[0].content).toBe(payload);

    const text = textHtml(String(rows.notes[0].content));
    expect(text).not.toContain("<script");
    expect(text).not.toContain(`"><script`);
    const area = textareaHtml(String(rows.notes[0].content));
    expect(area).not.toMatch(/<script/i);
  });
});

describe("QA 1(b) — absence de sortie HTML non échappée dans le code", () => {
  it("aucun dangerouslySetInnerHTML sous app/ components/ lib/", () => {
    const offenders: string[] = [];
    for (const dir of [path.join(ROOT, "app"), path.join(ROOT, "components"), path.join(ROOT, "lib")]) {
      for (const f of walk(dir)) {
        if (!/\.(ts|tsx)$/.test(f)) continue;
        if (/dangerouslySetInnerHTML\s*=\{/.test(readFileSync(f, "utf8"))) offenders.push(path.relative(ROOT, f));
      }
    }
    expect(offenders, `endroits risquant un HTML non échappé :\n${offenders.join("\n")}`).toEqual([]);
  });

  it("les pages publiques de détail (articles/projets [slug]) passent par <Markdown>", () => {
    const siteDir = path.join(ROOT, "app", "(site)");
    const slugPages = walk(siteDir).filter((f) => f.endsWith("page.tsx") && f.includes("[slug]"));
    expect(slugPages.length).toBeGreaterThan(0);
    for (const f of slugPages) {
      expect(readFileSync(f, "utf8"), path.relative(ROOT, f)).toContain("Markdown");
    }
  });

  it("les zones de saisie admin affichent le contenu brut uniquement via des éléments React (pas de HTML)", () => {
    // Le formulaire de contact lui-même n'encode jamais le HTML : contrôle
    // transversal = aucun composant admin ne compose du HTML par concaténation.
    const adminComponents = walk(path.join(ROOT, "components", "admin")).filter((f) => /\.tsx$/.test(f));
    const offenders = adminComponents.filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});