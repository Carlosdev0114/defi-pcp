import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError } from "@/lib/server/api";
import { serviceUpdateSchema } from "@/lib/server/validation";
import { invalidate } from "@/lib/server/cache";
import { markRagStale } from "@/lib/server/rag/index";
import { logActivity } from "@/lib/server/audit";

type Ctx = RouteContext<"/api/admin/services/[id]">;

export function PATCH(req: NextRequest, ctx: Ctx) {
  return withAdmin("PATCH /api/admin/services/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, serviceUpdateSchema);
    if (error) return error;
    const service = await db.$transaction(async (tx) => {
      const updated = await tx.service.update({ where: { id }, data });
      await logActivity(tx, admin.id, "service.update", "service", id);
      return updated;
    });
    await Promise.all([invalidate("services", "slots"), markRagStale()]);
    revalidatePath("/"); // l'accueil (statique) liste les services
    return NextResponse.json(service);
  });
}

/** Un service avec des RDV n'est pas supprimé (historique) : on le désactive
 * via PATCH { active: false }. Sans RDV, suppression avec ses dispos. */
export function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAdmin("DELETE /api/admin/services/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const result = await db.$transaction(async (tx) => {
      if ((await tx.appointment.count({ where: { serviceId: id } })) > 0) return "has-appointments" as const;
      await tx.availability.deleteMany({ where: { serviceId: id } });
      await tx.service.delete({ where: { id } });
      await logActivity(tx, admin.id, "service.delete", "service", id);
      return "deleted" as const;
    });
    if (result === "has-appointments") {
      return apiError("Ce service a des rendez-vous : désactivez-le plutôt que de le supprimer.", 409);
    }
    await Promise.all([invalidate("services", "slots"), markRagStale()]);
    revalidatePath("/"); // l'accueil (statique) liste les services
    return new NextResponse(null, { status: 204 });
  });
}
