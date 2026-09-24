import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError } from "@/lib/server/api";
import { leadUpdateSchema } from "@/lib/server/validation";
import { logActivity, notify } from "@/lib/server/audit";
import { bumpAdminVersion } from "@/lib/server/realtime";

type Ctx = RouteContext<"/api/admin/leads/[id]">;

export function GET(_req: NextRequest, ctx: Ctx) {
  return withAdmin("GET /api/admin/leads/[id]", async () => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    // Notes et événements bornés (50 derniers) : pas de liste illimitée.
    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        contact: true,
        notes: { orderBy: { createdAt: "desc" }, take: 50 },
        events: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    return lead ? NextResponse.json(lead) : apiError("Lead introuvable.", 404);
  });
}

/**
 * Déplacement dans le pipeline : la mise à jour du statut, l'événement
 * horodaté from → to, le journal et la notification partent dans la même
 * transaction — l'historique ne peut pas diverger du statut courant.
 */
export function PATCH(req: NextRequest, ctx: Ctx) {
  return withAdmin("PATCH /api/admin/leads/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, leadUpdateSchema);
    if (error) return error;

    const lead = await db.$transaction(async (tx) => {
      const current = await tx.lead.findUniqueOrThrow({
        where: { id },
        select: { status: true, contact: { select: { name: true } } },
      });
      const updated = await tx.lead.update({ where: { id }, data });
      if (data.status && data.status !== current.status) {
        await tx.leadEvent.create({ data: { leadId: id, fromStatus: current.status, toStatus: data.status } });
        await logActivity(tx, admin.id, `lead.status.${data.status.toLowerCase()}`, "lead", id);
        await notify(tx, "lead", { leadId: id, name: current.contact.name, from: current.status, to: data.status });
      } else {
        await logActivity(tx, admin.id, "lead.update", "lead", id);
      }
      return updated;
    });
    await bumpAdminVersion();
    return NextResponse.json(lead);
  });
}
