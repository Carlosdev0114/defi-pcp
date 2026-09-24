import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withAdmin, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";

const querySchema = paginationSchema.extend({
  // "untriaged" = contacts pas encore promus en lead (boîte de tri).
  filter: z.enum(["all", "untriaged"]).default("all"),
});

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/contacts", async () => {
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;
    const where = q.filter === "untriaged" ? { lead: { is: null } } : {};
    const [items, total] = await db.$transaction([
      db.contact.findMany({
        where,
        include: { lead: { select: { id: true, status: true } } },
        orderBy: { createdAt: "desc" },
        ...toSkipTake(q),
      }),
      db.contact.count({ where }),
    ]);
    return NextResponse.json(paginated(items, total, q));
  });
}
