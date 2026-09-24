import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseQuery, paginationSchema, paginated, toSkipTake, toDate } from "@/lib/server/api";
import { projectCreateSchema } from "@/lib/server/validation";
import { withMediaUrl } from "@/lib/server/storage";
import { revalidateContent } from "@/lib/server/revalidate";
import { logActivity } from "@/lib/server/audit";

const querySchema = paginationSchema.extend({ status: z.enum(["draft", "published"]).optional() });

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/projects", async () => {
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;
    const where = q.status === "draft" ? { publishedAt: null } : q.status === "published" ? { publishedAt: { not: null } } : {};
    const [items, total] = await db.$transaction([
      db.project.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: { media: { select: { id: true, url: true, altText: true, width: true, height: true }, orderBy: { createdAt: "asc" } } },
        ...toSkipTake(q),
      }),
      db.project.count({ where }),
    ]);
    return NextResponse.json(paginated(items.map((p) => ({ ...p, media: p.media.map((m) => withMediaUrl(m)) })), total, q));
  });
}

export function POST(req: NextRequest) {
  return withAdmin("POST /api/admin/projects", async (admin) => {
    const { data, error } = await parseJsonBody(req, projectCreateSchema, 64 * 1024);
    if (error) return error;
    const project = await db.$transaction(async (tx) => {
      const created = await tx.project.create({ data: { ...data, publishedAt: toDate(data.publishedAt) } });
      await logActivity(tx, admin.id, "project.create", "project", created.id);
      return created;
    });
    await revalidateContent("project", [project.slug]);
    return NextResponse.json(project, { status: 201 });
  });
}
