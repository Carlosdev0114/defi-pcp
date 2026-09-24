import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withAdmin, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { rangeQuerySchema } from "@/lib/server/validation";
import { APPOINTMENT_STATUSES, appointmentReference } from "@/lib/booking/status";

const querySchema = paginationSchema.extend({
  ...rangeQuerySchema.shape,
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/appointments", async () => {
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;
    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to
        ? { startAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(q.to) } : {}) } }
        : {}),
    };
    const [items, total, byStatus] = await db.$transaction([
      db.appointment.findMany({
        where,
        include: { service: { select: { id: true, name: true, durationMin: true } } },
        orderBy: [{ startAt: "asc" }, { id: "asc" }], // ordre stable entre les pages
        ...toSkipTake(q),
      }),
      db.appointment.count({ where }),
      db.appointment.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    ]);

    // Totaux par statut (tous les statuts, 0 compris) pour les onglets.
    const counts = Object.fromEntries(
      APPOINTMENT_STATUSES.map((s) => {
        const row = byStatus.find((r) => r.status === s);
        return [s, row && typeof row._count === "object" ? row._count._all ?? 0 : 0];
      })
    );

    return NextResponse.json({
      ...paginated(
        items.map((a) => ({ ...a, reference: appointmentReference(a.id) })),
        total,
        q
      ),
      counts,
    });
  });
}
