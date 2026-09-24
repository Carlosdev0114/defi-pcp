import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withErrors, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { cached } from "@/lib/server/cache";
import { withMediaUrl } from "@/lib/server/storage";

// Publié = date de publication renseignée et atteinte (permet la programmation).
const publishedNow = () => ({ publishedAt: { not: null, lte: new Date() } });

export function GET(req: NextRequest) {
  return withErrors("GET /api/public/articles", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const body = await cached("articles", `list:${page.page}:${page.pageSize}`, async () => {
      const where = publishedNow();
      const [items, total] = await db.$transaction([
        db.article.findMany({
          where,
          select: {
            id: true, slug: true, title: true, excerpt: true, publishedAt: true,
            coverMedia: { select: { url: true, altText: true, width: true, height: true } },
          },
          orderBy: { publishedAt: "desc" },
          ...toSkipTake(page),
        }),
        db.article.count({ where }),
      ]);
      return paginated(items.map((a) => ({ ...a, coverMedia: withMediaUrl(a.coverMedia) })), total, page);
    });
    return NextResponse.json(body);
  });
}
