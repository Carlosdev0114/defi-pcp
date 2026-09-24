import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withErrors, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { cached } from "@/lib/server/cache";

const where = { active: true };

export function GET(req: NextRequest) {
  return withErrors("GET /api/public/services", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const body = await cached("services", `list:${page.page}:${page.pageSize}`, async () => {
      const [items, total] = await db.$transaction([
        db.service.findMany({
          where,
          select: { id: true, name: true, durationMin: true, description: true },
          orderBy: { durationMin: "asc" },
          ...toSkipTake(page),
        }),
        db.service.count({ where }),
      ]);
      return paginated(items, total, page);
    });
    return NextResponse.json(body);
  });
}
