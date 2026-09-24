import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { serviceCreateSchema } from "@/lib/server/validation";
import { invalidate } from "@/lib/server/cache";
import { markRagStale } from "@/lib/server/rag/index";
import { logActivity } from "@/lib/server/audit";

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/services", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const [items, total] = await db.$transaction([
      db.service.findMany({ include: { availability: true }, orderBy: { name: "asc" }, ...toSkipTake(page) }),
      db.service.count(),
    ]);
    return NextResponse.json(paginated(items, total, page));
  });
}

export function POST(req: NextRequest) {
  return withAdmin("POST /api/admin/services", async (admin) => {
    const { data, error } = await parseJsonBody(req, serviceCreateSchema);
    if (error) return error;
    const service = await db.$transaction(async (tx) => {
      const created = await tx.service.create({ data });
      await logActivity(tx, admin.id, "service.create", "service", created.id);
      return created;
    });
    await Promise.all([invalidate("services", "slots"), markRagStale()]);
    revalidatePath("/"); // l'accueil (statique) liste les services
    return NextResponse.json(service, { status: 201 });
  });
}
