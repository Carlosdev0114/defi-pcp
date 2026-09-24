import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withErrors, apiError } from "@/lib/server/api";
import { cached } from "@/lib/server/cache";
import { withMediaUrl } from "@/lib/server/storage";

const slugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);

export function GET(_req: NextRequest, ctx: RouteContext<"/api/public/articles/[slug]">) {
  return withErrors("GET /api/public/articles/[slug]", async () => {
    const parsed = slugSchema.safeParse((await ctx.params).slug);
    if (!parsed.success) return apiError("Article introuvable.", 404);
    const article = await cached("articles", `slug:${parsed.data}`, async () => {
      const found = await db.article.findFirst({
        where: { slug: parsed.data, publishedAt: { not: null, lte: new Date() } },
        include: { coverMedia: { select: { url: true, altText: true, width: true, height: true } } },
      });
      return found && { ...found, coverMedia: withMediaUrl(found.coverMedia) };
    });
    return article ? NextResponse.json(article) : apiError("Article introuvable.", 404);
  });
}
