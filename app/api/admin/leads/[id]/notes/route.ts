import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError } from "@/lib/server/api";
import { leadNoteSchema } from "@/lib/server/validation";
import { logActivity } from "@/lib/server/audit";

export function POST(req: NextRequest, ctx: RouteContext<"/api/admin/leads/[id]/notes">) {
  return withAdmin("POST /api/admin/leads/[id]/notes", async (admin) => {
    const leadId = parseId((await ctx.params).id);
    if (!leadId) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, leadNoteSchema);
    if (error) return error;

    const note = await db.$transaction(async (tx) => {
      const created = await tx.leadNote.create({ data: { leadId, content: data.content } });
      // Touche le lead pour qu'il remonte en tête de liste (tri par updatedAt).
      await tx.lead.update({ where: { id: leadId }, data: { updatedAt: new Date() } });
      await logActivity(tx, admin.id, "lead.note", "lead", leadId);
      return created;
    });
    return NextResponse.json(note, { status: 201 });
  });
}
