import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError } from "@/lib/server/api";
import { availabilityReplaceSchema } from "@/lib/server/validation";
import { invalidate } from "@/lib/server/cache";
import { logActivity } from "@/lib/server/audit";

type Ctx = RouteContext<"/api/admin/services/[id]/availability">;

export function GET(_req: NextRequest, ctx: Ctx) {
  return withAdmin("GET availability", async () => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const slots = await db.availability.findMany({
      where: { serviceId: id },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });
    return NextResponse.json({ items: slots });
  });
}

/** Remplace tout le planning hebdomadaire d'un service, atomiquement :
 * jamais d'état intermédiaire « sans dispo » visible des visiteurs. */
export function PUT(req: NextRequest, ctx: Ctx) {
  return withAdmin("PUT availability", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, availabilityReplaceSchema);
    if (error) return error;

    const slots = await db.$transaction(async (tx) => {
      await tx.service.findUniqueOrThrow({ where: { id }, select: { id: true } });
      await tx.availability.deleteMany({ where: { serviceId: id } });
      await tx.availability.createMany({ data: data.slots.map((s) => ({ ...s, serviceId: id })) });
      await logActivity(tx, admin.id, "availability.replace", "service", id);
      return tx.availability.findMany({ where: { serviceId: id }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
    });
    await invalidate("slots");
    return NextResponse.json({ items: slots });
  });
}
