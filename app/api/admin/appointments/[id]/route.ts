import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError } from "@/lib/server/api";
import { appointmentStatusSchema } from "@/lib/server/validation";
import { invalidate } from "@/lib/server/cache";
import { logActivity } from "@/lib/server/audit";
import { canTransition } from "@/lib/booking/status";

// Transitions autorisées : règle partagée avec l'interface (lib/booking/status).

export function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/appointments/[id]">) {
  return withAdmin("PATCH /api/admin/appointments/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, appointmentStatusSchema);
    if (error) return error;

    const result = await db.$transaction(async (tx) => {
      const current = await tx.appointment.findUniqueOrThrow({ where: { id }, select: { status: true } });
      if (!canTransition(current.status, data.status)) return { conflict: current.status };
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.status === "CONFIRMED" ? { assignedToId: admin.id } : {}),
        },
      });
      await logActivity(tx, admin.id, `appointment.${data.status.toLowerCase()}`, "appointment", id);
      return { updated };
    });

    if ("conflict" in result) {
      return apiError(`Transition impossible : ${result.conflict} → ${data.status}.`, 409);
    }
    await invalidate("slots"); // un refus/annulation libère le créneau
    return NextResponse.json(result.updated);
  });
}
