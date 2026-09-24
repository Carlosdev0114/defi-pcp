import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseQuery, paginationSchema, paginated, toSkipTake, toDate } from "@/lib/server/api";
import { experienceCreateSchema } from "@/lib/server/validation";
import { logActivity } from "@/lib/server/audit";
import { revalidateContent } from "@/lib/server/revalidate";

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/experiences", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const [items, total] = await db.$transaction([
      db.experience.findMany({ orderBy: [{ order: "asc" }, { startDate: "desc" }], ...toSkipTake(page) }),
      db.experience.count(),
    ]);
    return NextResponse.json(paginated(items, total, page));
  });
}

export function POST(req: NextRequest) {
  return withAdmin("POST /api/admin/experiences", async (admin) => {
    const { data, error } = await parseJsonBody(req, experienceCreateSchema, 32 * 1024);
    if (error) return error;
    const experience = await db.$transaction(async (tx) => {
      const created = await tx.experience.create({
        data: { ...data, startDate: toDate(data.startDate), endDate: toDate(data.endDate) },
      });
      await logActivity(tx, admin.id, "experience.create", "experience", created.id);
      return created;
    });
    await revalidateContent("experience");
    return NextResponse.json(experience, { status: 201 });
  });
}
