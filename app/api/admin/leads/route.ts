import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { leadStatusEnum } from "@/lib/server/validation";
import { getPipelineSummary } from "@/lib/server/crm";

const querySchema = paginationSchema.extend({ status: leadStatusEnum.optional() });

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/leads", async () => {
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;
    const where = q.status ? { status: q.status } : {};
    const [[items, total], pipeline] = await Promise.all([
      db.$transaction([
        db.lead.findMany({
          where,
          include: { contact: { select: { name: true, email: true } } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }], // ordre stable entre les pages
          ...toSkipTake(q),
        }),
        db.lead.count({ where }),
      ]),
      getPipelineSummary(),
    ]);
    return NextResponse.json({ ...paginated(items, total, q), pipeline });
  });
}
