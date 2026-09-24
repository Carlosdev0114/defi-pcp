import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withErrors, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { cached } from "@/lib/server/cache";

export function GET(req: NextRequest) {
  return withErrors("GET /api/public/skills", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const body = await cached("skills", `list:${page.page}:${page.pageSize}`, async () => {
      const [items, total] = await db.$transaction([
        db.skill.findMany({
          select: { id: true, name: true, category: true, level: true },
          orderBy: [{ category: "asc" }, { order: "asc" }],
          ...toSkipTake(page),
        }),
        db.skill.count(),
      ]);
      return paginated(items, total, page);
    });
    return NextResponse.json(body);
  });
}
