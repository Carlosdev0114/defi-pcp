import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withErrors, apiError } from "@/lib/server/api";
import { cached } from "@/lib/server/cache";
import { withMediaUrl } from "@/lib/server/storage";

const slugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);

export function GET(_req: NextRequest, ctx: RouteContext<"/api/public/projects/[slug]">) {
  return withErrors("GET /api/public/projects/[slug]", async () => {
    const parsed = slugSchema.safeParse((await ctx.params).slug);
    if (!parsed.success) return apiError("Projet introuvable.", 404);
    const project = await cached("projects", `slug:${parsed.data}`, async () => {
      const found = await db.project.findFirst({
        where: { slug: parsed.data, publishedAt: { not: null, lte: new Date() } },
        include: { media: { select: { url: true, altText: true, width: true, height: true } } },
      });
      return found && { ...found, media: found.media.map((m) => withMediaUrl(m)) };
    });
    return project ? NextResponse.json(project) : apiError("Projet introuvable.", 404);
  });
}
