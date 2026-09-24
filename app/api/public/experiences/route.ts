import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withErrors, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { cached } from "@/lib/server/cache";

export function GET(req: NextRequest) {
  return withErrors("GET /api/public/experiences", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const body = await cached("experiences", `list:${page.page}:${page.pageSize}`, async () => {
      const [items, total] = await db.$transaction([
        db.experience.findMany({
          select: { id: true, company: true, title: true, location: true, startDate: true, endDate: true, description: true },
          orderBy: [{ order: "asc" }, { startDate: "desc" }],
          ...toSkipTake(page),
        }),
        db.experience.count(),
      ]);
      return paginated(items, total, page);
    });
    return NextResponse.json(body);
  });
}
