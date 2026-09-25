import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import {
  ALLOWED_TYPES,
  MAX_UPLOAD_BYTES,
  UploadRejectedError,
  detectImageType,
  processAndStoreImage,
} from "@/lib/server/media";
import type { Storage } from "@/lib/server/storage/types";

// QA — brief 1(c). Upload sûrs.
//   1. Pipeline réel (lib/server/media.ts, sharp) : extension ou Content-Type
//      déclarés ne font JAMAIS foi — seuls les octets comptent. Le SVG (XML
//      exécutable) est interdit, un exécutable et une page HTML sont refusés,
//      une déclaration contradictoire est refusée, > 4 Mo est refusé (avant
//      et pendant le pipeline), un fichier valide ressort ré-encodé WebP.
//   2. Route /api/admin/media : 401 sans session, 415/413 avant toute
//      lecture du corps, 400 sans fichier, 422 pour un contenu inacceptable.

const m = vi.hoisted(() => ({
  session: null as null | { userId: string; role: string; email: string },
  user: null as null | { id: string; email: string; name: string | null; role: string },
}));

vi.mock("@/lib/server/session", () => ({
  getCurrentSession: async () =>
    m.session ? { userId: m.session.userId, role: m.session.role, email: m.session.email, sessionId: "s" } : null,
}));
vi.mock("@/lib/server/redis", () => ({ getRedis: () => ({}) }));
vi.mock("@/lib/server/audit", () => ({ notify: async () => {}, logActivity: async () => {} }));
vi.mock("@/lib/server/db", () => {
  const forbidden = () => {
    throw new Error("db touchée hors scénario");
  };
  const chain = () =>
    new Proxy(function () {}, {
      get: () => chain(),
      apply: () => forbidden(),
    });
  const base = {
    user: { findUnique: async () => (m.user ? { id: m.user.id, email: m.user.email, name: m.user.name, role: m.user.role } : null) },
    media: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "m1", ...data }),
      findMany: chain,
      count: chain,
    },
  };
  return {
    db: new Proxy(base, {
      get: (target, prop) => (prop in target ? (target as Record<string, unknown>)[prop as string] : chain()),
    }),
  };
});

function stubStorage() {
  return {
    driver: "local" as const,
    put: vi.fn(async () => {}),
    get: vi.fn(async () => null as Buffer | null),
    delete: vi.fn(async () => {}),
    getUrl: (key: string) => `https://cdn.test/${key}`,
  } as unknown as Storage & { put: ReturnType<typeof vi.fn> };
}

const pngBytes = () => sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 230, g: 57, b: 70 } } }).png().toBuffer();

const EXE_MZ = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff]);
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>`;
const HTML = `<!DOCTYPE html><html><body><iframe src="https://evil.example"></iframe></body></html>`;

async function expectRejected(file: File, message: RegExp) {
  const storage = stubStorage();
  await expect(processAndStoreImage(file, storage)).rejects.toBeInstanceOf(UploadRejectedError);
  await expect(processAndStoreImage(file, storage)).rejects.toThrow(message);
  expect(storage.put).not.toHaveBeenCalled();
  return storage;
}

beforeEach(() => {
  m.session = { userId: "u1", role: "ADMIN", email: "admin@test.fr" };
  m.user = { id: "u1", email: "admin@test.fr", name: "Admin", role: "ADMIN" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QA 1(c) — pipeline média (magic bytes, ré-encodage, bornes)", () => {
  it("détection : PNG reconnu par ses octets, exécutable MZ reconnu comme inacceptable", async () => {
    const png = await pngBytes();
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(EXE_MZ)).toBeNull();
    expect(ALLOWED_TYPES).toEqual(["image/jpeg", "image/png", "image/webp", "image/avif"]);
  });

  it("exécutable .exe renommé .png → refusé : l'extension et le type déclaré ne font pas foi", async () => {
    await expectRejected(new File([EXE_MZ], "malware.png", { type: "image/png" }), /Format non autorisé/);
  });

  it("SVG (XML exécutable) → refusé même déclaré image/svg+xml", async () => {
    await expectRejected(new File([SVG], "vector.svg", { type: "image/svg+xml" }), /Format non autorisé/);
    await expectRejected(new File([SVG], "vector.png", { type: "image/png" }), /Format non autorisé/);
  });

  it("page HTML déguisée → refusée", async () => {
    await expectRejected(new File([HTML], "page.html", { type: "text/html" }), /Format non autorisé/);
  });

  it("type déclaré contradictoire (PNG déclaré image/jpeg) → refusé comme falsifié", async () => {
    const png = await pngBytes();
    await expectRejected(new File([png], "fausse.jpeg", { type: "image/jpeg" }), /ne correspond pas à son type déclaré/);
  });

  it("fichier vide → refusé", async () => {
    await expectRejected(new File([], "vide.png", { type: "image/png" }), /Fichier vide ou supérieur à 4 Mo/);
  });

  it("fichier > 4 Mo (même annoncé image/png) → refusé sans lecture complète", async () => {
    await expectRejected(new File([Buffer.alloc(MAX_UPLOAD_BYTES + 1)], "trop-gros.png", { type: "image/png" }), /Fichier vide ou supérieur à 4 Mo/);
  });

  it("PNG 1×1 valide → ré-encodé WebP (EXIF/GPS retirés), clé UUID, aucune écriture parasite", async () => {
    const storage = stubStorage();
    const stored = await processAndStoreImage(new File([await pngBytes()], "photo.png", { type: "image/png" }), storage);
    expect(stored.mimeType).toBe("image/webp");
    expect(stored.width).toBe(1);
    expect(stored.height).toBe(1);
    expect(stored.sizeBytes).toBeGreaterThan(0);
    expect(stored.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/);
    expect(storage.put).toHaveBeenCalledTimes(1);
    expect(storage.put).toHaveBeenCalledWith(stored.key, expect.any(Buffer), "image/webp");
    const written = (storage.put as ReturnType<typeof vi.fn>).mock.calls[0][1] as Buffer;
    expect(written.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(written.subarray(8, 12).toString("latin1")).toBe("WEBP");
  });
});

describe("QA 1(c) — route /api/admin/media", () => {
  const post = (init?: { headers?: HeadersInit; body?: BodyInit }) =>
    new NextRequest("http://localhost/api/admin/media", { method: "POST", ...init });

  it("sans session → 401 avant même de lire le corps", async () => {
    m.session = null;
    m.user = null;
    const { POST } = await import("@/app/api/admin/media/route");
    const res = await POST(post());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Non autorisé." });
  });

  it("Content-Type hors multipart → 415", async () => {
    const { POST } = await import("@/app/api/admin/media/route");
    const res = await POST(post({ headers: { "content-type": "text/plain" }, body: "x" }));
    expect(res.status).toBe(415);
  });

  it("taille annoncée (content-length) > 4 Mo + marge → 413 avant lecture du corps", async () => {
    const req = post();
    req.headers.set("content-type", "multipart/form-data; boundary=anything");
    req.headers.set("content-length", String(MAX_UPLOAD_BYTES + 128 * 1024));
    const { POST } = await import("@/app/api/admin/media/route");
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("multipart sans champ `file` → 400", async () => {
    const { POST } = await import("@/app/api/admin/media/route");
    const res = await POST(new NextRequest("http://localhost/api/admin/media", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(400);
    expect((await res.json()) as { error?: string }).toMatchObject({ error: "Champ `file` manquant." });
  });

  it("contenu inacceptable (HTML) dans un multipart valide → 422, rien n'est stocké", async () => {
    const { POST } = await import("@/app/api/admin/media/route");
    const form = new FormData();
    form.append("file", new File([HTML], "page.html", { type: "text/html" }));
    const res = await POST(new NextRequest("http://localhost/api/admin/media", { method: "POST", body: form }));
    expect(res.status).toBe(422);
    expect((await res.json()) as { error?: string }).toMatchObject({ error: expect.stringMatching(/Format non autorisé/) });
  });
});