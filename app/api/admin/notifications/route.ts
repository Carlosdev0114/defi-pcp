import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { notificationsReadSchema } from "@/lib/server/validation";
import { bumpAdminVersion } from "@/lib/server/realtime";

const querySchema = paginationSchema.extend({
  unread: z.enum(["true", "false"]).optional(),
});

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/notifications", async () => {
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;
    const where = q.unread === "true" ? { read: false } : {};
    const [items, total, unread] = await db.$transaction([
      db.notification.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(q) }),
      db.notification.count({ where }),
      db.notification.count({ where: { read: false } }),
    ]);
    return NextResponse.json({ ...paginated(items, total, q), unread });
  });
}

/** Marque des notifications comme lues (liste d'ids ou toutes). */
export function PATCH(req: NextRequest) {
  return withAdmin("PATCH /api/admin/notifications", async () => {
    const { data, error } = await parseJsonBody(req, notificationsReadSchema);
    if (error) return error;
    const { count } = await db.notification.updateMany({
      where: data.all ? { read: false } : { id: { in: data.ids ?? [] } },
      data: { read: true },
    });
    if (count) await bumpAdminVersion();
    return NextResponse.json({ updated: count });
  });
}
