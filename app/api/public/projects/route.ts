import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withErrors, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { cached } from "@/lib/server/cache";
import { withMediaUrl } from "@/lib/server/storage";

// Publié = date de publication renseignée et atteinte (permet la programmation).
const publishedNow = () => ({ publishedAt: { not: null, lte: new Date() } });

export function GET(req: NextRequest) {
  return withErrors("GET /api/public/projects", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const body = await cached("projects", `list:${page.page}:${page.pageSize}`, async () => {
      const where = publishedNow();
      const [items, total] = await db.$transaction([
        db.project.findMany({
          where,
          select: {
            id: true, slug: true, title: true, summary: true, techStack: true, role: true,
            featured: true, publishedAt: true,
            media: { select: { url: true, altText: true, width: true, height: true }, take: 1 },
          },
          orderBy: [{ featured: "desc" }, { order: "asc" }, { publishedAt: "desc" }],
          ...toSkipTake(page),
        }),
        db.project.count({ where }),
      ]);
      return paginated(items.map((p) => ({ ...p, media: p.media.map((m) => withMediaUrl(m)) })), total, page);
    });
    return NextResponse.json(body);
  });
}
