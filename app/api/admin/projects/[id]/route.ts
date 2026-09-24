import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError, toDate } from "@/lib/server/api";
import { withMediaUrl } from "@/lib/server/storage";
import { projectUpdateSchema } from "@/lib/server/validation";
import { revalidateContent } from "@/lib/server/revalidate";
import { logActivity } from "@/lib/server/audit";

type Ctx = RouteContext<"/api/admin/projects/[id]">;

export function GET(_req: NextRequest, ctx: Ctx) {
  return withAdmin("GET /api/admin/projects/[id]", async () => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const project = await db.project.findUnique({ where: { id }, include: { media: true } });
    return project
      ? NextResponse.json({ ...project, media: project.media.map((m) => withMediaUrl(m)) })
      : apiError("Projet introuvable.", 404);
  });
}

/** Modification, publication (`publishedAt` = date) ou dépublication (`null`). */
export function PATCH(req: NextRequest, ctx: Ctx) {
  return withAdmin("PATCH /api/admin/projects/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, projectUpdateSchema, 64 * 1024);
    if (error) return error;
    const { before, project } = await db.$transaction(async (tx) => {
      const before = await tx.project.findUniqueOrThrow({ where: { id }, select: { slug: true } });
      const project = await tx.project.update({ where: { id }, data: { ...data, publishedAt: toDate(data.publishedAt) } });
      await logActivity(tx, admin.id, "project.update", "project", id);
      return { before, project };
    });
    // Ancien ET nouveau slug : un changement de slug ne laisse pas l'ancienne page en cache.
    await revalidateContent("project", [before.slug, project.slug]);
    return NextResponse.json(project);
  });
}

export function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAdmin("DELETE /api/admin/projects/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    // Les médias sont détachés (conservés dans la médiathèque) avant la suppression.
    const deleted = await db.$transaction(async (tx) => {
      await tx.media.updateMany({ where: { projectId: id }, data: { projectId: null } });
      const deleted = await tx.project.delete({ where: { id }, select: { slug: true } });
      await logActivity(tx, admin.id, "project.delete", "project", id);
      return deleted;
    });
    await revalidateContent("project", [deleted.slug]);
    return new NextResponse(null, { status: 204 });
  });
}
