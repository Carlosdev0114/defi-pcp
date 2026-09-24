import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";
import { calendarEventCreateSchema, rangeQuerySchema } from "@/lib/server/validation";
import { invalidate } from "@/lib/server/cache";
import { logActivity } from "@/lib/server/audit";

const querySchema = paginationSchema.extend(rangeQuerySchema.shape);

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/calendar-events", async () => {
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;
    const where = {
      ...(q.to ? { startAt: { lt: new Date(q.to) } } : {}),
      ...(q.from ? { endAt: { gt: new Date(q.from) } } : {}),
    };
    const [items, total] = await db.$transaction([
      db.calendarEvent.findMany({ where, orderBy: { startAt: "asc" }, ...toSkipTake(q) }),
      db.calendarEvent.count({ where }),
    ]);
    return NextResponse.json(paginated(items, total, q));
  });
}

export function POST(req: NextRequest) {
  return withAdmin("POST /api/admin/calendar-events", async (admin) => {
    const { data, error } = await parseJsonBody(req, calendarEventCreateSchema);
    if (error) return error;
    const event = await db.$transaction(async (tx) => {
      const created = await tx.calendarEvent.create({
        data: { ...data, startAt: new Date(data.startAt), endAt: new Date(data.endAt) },
      });
      await logActivity(tx, admin.id, "calendar.block", "calendarEvent", created.id);
      return created;
    });
    await invalidate("slots");
    return NextResponse.json(event, { status: 201 });
  });
}
