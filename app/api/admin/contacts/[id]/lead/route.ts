import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError } from "@/lib/server/api";
import { leadPromoteSchema } from "@/lib/server/validation";
import { logActivity, notify } from "@/lib/server/audit";
import { bumpAdminVersion } from "@/lib/server/realtime";

/**
 * Promotion Contact → Lead : décision humaine explicite (voir DATABASE.md).
 * Transaction multi-tables : Lead + LeadEvent initial (∅ → NEW) + Activity +
 * Notification, tout ou rien. L'unicité Lead.contactId garantit qu'un
 * contact n'est promu qu'une fois (409 sinon).
 */
export function POST(req: NextRequest, ctx: RouteContext<"/api/admin/contacts/[id]/lead">) {
  return withAdmin("POST /api/admin/contacts/[id]/lead", async (admin) => {
    const contactId = parseId((await ctx.params).id);
    if (!contactId) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, leadPromoteSchema);
    if (error) return error;

    const lead = await db.$transaction(async (tx) => {
      const contact = await tx.contact.findUniqueOrThrow({ where: { id: contactId }, select: { name: true } });
      const created = await tx.lead.create({
        data: { contactId, value: data.value ?? null, source: data.source ?? "Formulaire de contact" },
      });
      await tx.leadEvent.create({ data: { leadId: created.id, fromStatus: null, toStatus: "NEW" } });
      await logActivity(tx, admin.id, "lead.create", "lead", created.id);
      await notify(tx, "lead", { leadId: created.id, name: contact.name, status: "NEW" });
      return created;
    });
    await bumpAdminVersion();
    return NextResponse.json(lead, { status: 201 });
  });
}
