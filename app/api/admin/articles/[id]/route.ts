import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError, toDate } from "@/lib/server/api";
import { withMediaUrl } from "@/lib/server/storage";
import { articleUpdateSchema } from "@/lib/server/validation";
import { revalidateContent } from "@/lib/server/revalidate";
import { logActivity } from "@/lib/server/audit";

type Ctx = RouteContext<"/api/admin/articles/[id]">;

export function GET(_req: NextRequest, ctx: Ctx) {
  return withAdmin("GET /api/admin/articles/[id]", async () => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const article = await db.article.findUnique({ where: { id }, include: { coverMedia: true } });
    return article
      ? NextResponse.json({ ...article, coverMedia: withMediaUrl(article.coverMedia) })
      : apiError("Article introuvable.", 404);
  });
}

/** Modification, publication (`publishedAt` = date) ou dépublication (`null`). */
export function PATCH(req: NextRequest, ctx: Ctx) {
  return withAdmin("PATCH /api/admin/articles/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, articleUpdateSchema, 128 * 1024);
    if (error) return error;
    const { before, article } = await db.$transaction(async (tx) => {
      const before = await tx.article.findUniqueOrThrow({ where: { id }, select: { slug: true } });
      const article = await tx.article.update({ where: { id }, data: { ...data, publishedAt: toDate(data.publishedAt) } });
      await logActivity(tx, admin.id, "article.update", "article", id);
      return { before, article };
    });
    await revalidateContent("article", [before.slug, article.slug]);
    return NextResponse.json(article);
  });
}

export function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAdmin("DELETE /api/admin/articles/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const deleted = await db.$transaction(async (tx) => {
      const deleted = await tx.article.delete({ where: { id }, select: { slug: true } });
      await logActivity(tx, admin.id, "article.delete", "article", id);
      return deleted;
    });
    await revalidateContent("article", [deleted.slug]);
    return new NextResponse(null, { status: 204 });
  });
}
