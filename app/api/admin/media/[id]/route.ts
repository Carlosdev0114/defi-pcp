import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError } from "@/lib/server/api";
import { mediaUpdateSchema } from "@/lib/server/validation";
import { deleteStoredImage } from "@/lib/server/media";
import { withMediaUrl } from "@/lib/server/storage";
import { logActivity } from "@/lib/server/audit";
import { revalidateContent } from "@/lib/server/revalidate";
import { getProfile, setProfile } from "@/lib/server/site-config";

/** La photo du profil vit dans Redis (pas de clé étrangère) : si ce média
 * l'est, le site entier doit être régénéré, et une suppression efface la
 * référence (le portrait repasse en espace réservé). */
async function syncProfilePhoto(mediaId: string, deleted: boolean) {
  const profile = await getProfile();
  if (profile.photoMediaId !== mediaId) return;
  if (deleted) await setProfile({ ...profile, photoMediaId: null });
  await revalidateContent("profile");
}

type Ctx = RouteContext<"/api/admin/media/[id]">;

export function PATCH(req: NextRequest, ctx: Ctx) {
  return withAdmin("PATCH /api/admin/media/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, mediaUpdateSchema);
    if (error) return error;
    const media = await db.$transaction(async (tx) => {
      const updated = await tx.media.update({ where: { id }, data });
      await logActivity(tx, admin.id, "media.update", "media", id);
      return updated;
    });
    await revalidateContent("media");
    await syncProfilePhoto(id, false);
    return NextResponse.json(withMediaUrl(media));
  });
}

export function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAdmin("DELETE /api/admin/media/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    // Transaction : les articles qui l'utilisaient en couverture perdent la
    // référence, puis le média est supprimé — jamais de clé étrangère cassée.
    const media = await db.$transaction(async (tx) => {
      await tx.article.updateMany({ where: { coverMediaId: id }, data: { coverMediaId: null } });
      const deleted = await tx.media.delete({ where: { id } });
      await logActivity(tx, admin.id, "media.delete", "media", id);
      return deleted;
    });
    await deleteStoredImage(media.url); // Media.url = clé de stockage
    await revalidateContent("media");
    await syncProfilePhoto(id, true);
    return new NextResponse(null, { status: 204 });
  });
}
