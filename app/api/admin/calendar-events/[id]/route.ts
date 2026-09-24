import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseId, apiError } from "@/lib/server/api";
import { invalidate } from "@/lib/server/cache";
import { logActivity } from "@/lib/server/audit";

export function DELETE(_req: NextRequest, ctx: RouteContext<"/api/admin/calendar-events/[id]">) {
  return withAdmin("DELETE /api/admin/calendar-events/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    await db.$transaction(async (tx) => {
      await tx.calendarEvent.delete({ where: { id } });
      await logActivity(tx, admin.id, "calendar.unblock", "calendarEvent", id);
    });
    await invalidate("slots");
    return new NextResponse(null, { status: 204 });
  });
}
