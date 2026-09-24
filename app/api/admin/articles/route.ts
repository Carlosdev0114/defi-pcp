import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseQuery, paginationSchema, paginated, toSkipTake, toDate } from "@/lib/server/api";
import { articleCreateSchema } from "@/lib/server/validation";
import { revalidateContent } from "@/lib/server/revalidate";
import { logActivity } from "@/lib/server/audit";

const querySchema = paginationSchema.extend({ status: z.enum(["draft", "published"]).optional() });

const listSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverMediaId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/articles", async () => {
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;
    const where = q.status === "draft" ? { publishedAt: null } : q.status === "published" ? { publishedAt: { not: null } } : {};
    // La liste ne renvoie pas `content` (potentiellement long) : lu via GET /[id].
    const [items, total] = await db.$transaction([
      db.article.findMany({ where, select: listSelect, orderBy: { createdAt: "desc" }, ...toSkipTake(q) }),
      db.article.count({ where }),
    ]);
    return NextResponse.json(paginated(items, total, q));
  });
}

export function POST(req: NextRequest) {
  return withAdmin("POST /api/admin/articles", async (admin) => {
    const { data, error } = await parseJsonBody(req, articleCreateSchema, 128 * 1024);
    if (error) return error;
    const article = await db.$transaction(async (tx) => {
      const created = await tx.article.create({ data: { ...data, publishedAt: toDate(data.publishedAt) } });
      await logActivity(tx, admin.id, "article.create", "article", created.id);
      return created;
    });
    await revalidateContent("article", [article.slug]);
    return NextResponse.json(article, { status: 201 });
  });
}
