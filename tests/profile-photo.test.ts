import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_PROFILE, profileSchema } from "@/lib/schemas/site";

// Photo du profil : un média de la médiathèque référencé dans le profil
// (Redis). Pas de clé étrangère : l'API vérifie que le média existe, et la
// suppression du média efface la référence (retour à l'espace réservé).

const KEY = "123e4567-e89b-42d3-a456-426614174000.webp";
const m = vi.hoisted(() => ({
  media: new Map<string, { id: string; url: string; altText: string | null; width: number; height: number }>(),
  profile: {} as Record<string, unknown>,
  setProfile: vi.fn(),
  revalidateContent: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({
  getCurrentSession: async () => ({ userId: "u1", role: "ADMIN", email: "admin@example.com", sessionId: "s" }),
}));
vi.mock("@/lib/server/db", () => {
  const tx = {
    article: { updateMany: async () => ({ count: 0 }) },
    media: { delete: async ({ where }: { where: { id: string } }) => { const row = m.media.get(where.id)!; m.media.delete(where.id); return row; } },
  };
  return {
    db: {
      user: { findUnique: async () => ({ id: "u1", email: "admin@example.com", name: "Admin", role: "ADMIN" }) },
      media: { findUnique: m.findUnique },
      activity: { create: async () => ({}) },
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});
vi.mock("@/lib/server/site-config", () => ({
  getProfile: async () => m.profile,
  setProfile: m.setProfile,
}));
vi.mock("@/lib/server/revalidate", () => ({ revalidateContent: m.revalidateContent }));
vi.mock("@/lib/server/media", () => ({ deleteStoredImage: async () => {} }));
vi.mock("@/lib/server/audit", () => ({ logActivity: async () => {} }));

beforeEach(() => {
  m.media.clear();
  m.media.set("photo1", { id: "photo1", url: KEY, altText: "Portrait", width: 1000, height: 1200 });
  m.media.set("autre1", { id: "autre1", url: KEY, altText: null, width: 800, height: 600 });
  m.findUnique.mockReset().mockImplementation(async ({ where }: { where: { id: string } }) => m.media.get(where.id) ?? null);
  m.profile = { ...DEFAULT_PROFILE, name: "Aguidissou Carlos", photoMediaId: "photo1" };
  m.setProfile.mockReset().mockImplementation(async (p: Record<string, unknown>) => (m.profile = p));
  m.revalidateContent.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const put = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("schéma du profil", () => {
  it("un profil enregistré sans photo reste valide (photoMediaId = null)", () => {
    const legacy = Object.fromEntries(Object.entries(DEFAULT_PROFILE).filter(([k]) => k !== "photoMediaId"));
    expect(profileSchema.parse(legacy).photoMediaId).toBeNull();
  });
  it("identifiant de média accepté, identifiant forgé refusé", () => {
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, photoMediaId: "cmu123abc" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, photoMediaId: "../../etc" }).success).toBe(false);
  });
});

describe("getProfilePhoto", () => {
  it("sans photo : null, sans requête en base", async () => {
    const { getProfilePhoto } = await import("@/lib/server/content");
    expect(await getProfilePhoto(null)).toBeNull();
    expect(m.findUnique).not.toHaveBeenCalled();
  });
  it("média supprimé : null (espace réservé) ; média présent : URL publique et dimensions", async () => {
    const { getProfilePhoto } = await import("@/lib/server/content");
    expect(await getProfilePhoto("inconnu")).toBeNull();
    expect(await getProfilePhoto("photo1")).toMatchObject({ url: `/media/${KEY}`, width: 1000, height: 1200, altText: "Portrait" });
  });
});

describe("PUT /api/admin/profile", () => {
  it("photo inexistante → 400, rien n'est enregistré", async () => {
    const { PUT } = await import("@/app/api/admin/profile/route");
    const res = await PUT(put({ ...DEFAULT_PROFILE, photoMediaId: "inconnu" }));
    expect(res.status).toBe(400);
    expect(m.setProfile).not.toHaveBeenCalled();
  });
  it("photo de la médiathèque → enregistrée, site régénéré", async () => {
    const { PUT } = await import("@/app/api/admin/profile/route");
    const res = await PUT(put({ ...DEFAULT_PROFILE, name: "Aguidissou Carlos", photoMediaId: "autre1" }));
    expect(res.status).toBe(200);
    expect(m.setProfile).toHaveBeenCalledWith(expect.objectContaining({ photoMediaId: "autre1" }));
    expect(m.revalidateContent).toHaveBeenCalledWith("profile");
  });
});

describe("DELETE /api/admin/media/[id]", () => {
  it("supprimer la photo du profil efface la référence et régénère tout le site", async () => {
    const { DELETE } = await import("@/app/api/admin/media/[id]/route");
    const res = await DELETE(new NextRequest("http://localhost/api/admin/media/photo1", { method: "DELETE" }), ctx("photo1"));
    expect(res.status).toBe(204);
    expect(m.setProfile).toHaveBeenCalledWith(expect.objectContaining({ photoMediaId: null }));
    expect(m.revalidateContent).toHaveBeenCalledWith("profile");
  });
  it("supprimer un autre média ne touche pas au profil", async () => {
    const { DELETE } = await import("@/app/api/admin/media/[id]/route");
    const res = await DELETE(new NextRequest("http://localhost/api/admin/media/autre1", { method: "DELETE" }), ctx("autre1"));
    expect(res.status).toBe(204);
    expect(m.setProfile).not.toHaveBeenCalled();
    expect(m.revalidateContent).not.toHaveBeenCalledWith("profile");
  });
});
