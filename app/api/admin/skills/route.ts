import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { skillCreateSchema } from "@/lib/server/validation";
import { logActivity } from "@/lib/server/audit";
import { revalidateContent } from "@/lib/server/revalidate";

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/skills", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const [items, total] = await db.$transaction([
      db.skill.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }], ...toSkipTake(page) }),
      db.skill.count(),
    ]);
    return NextResponse.json(paginated(items, total, page));
  });
}

export function POST(req: NextRequest) {
  return withAdmin("POST /api/admin/skills", async (admin) => {
    const { data, error } = await parseJsonBody(req, skillCreateSchema);
    if (error) return error;
    const skill = await db.$transaction(async (tx) => {
      const created = await tx.skill.create({ data });
      await logActivity(tx, admin.id, "skill.create", "skill", created.id);
      return created;
    });
    await revalidateContent("skill");
    return NextResponse.json(skill, { status: 201 });
  });
}
