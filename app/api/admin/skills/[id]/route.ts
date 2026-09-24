import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError } from "@/lib/server/api";
import { skillUpdateSchema } from "@/lib/server/validation";
import { logActivity } from "@/lib/server/audit";
import { revalidateContent } from "@/lib/server/revalidate";

type Ctx = RouteContext<"/api/admin/skills/[id]">;

export function PATCH(req: NextRequest, ctx: Ctx) {
  return withAdmin("PATCH /api/admin/skills/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, skillUpdateSchema);
    if (error) return error;
    const skill = await db.$transaction(async (tx) => {
      const updated = await tx.skill.update({ where: { id }, data });
      await logActivity(tx, admin.id, "skill.update", "skill", id);
      return updated;
    });
    await revalidateContent("skill");
    return NextResponse.json(skill);
  });
}

export function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAdmin("DELETE /api/admin/skills/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    await db.$transaction(async (tx) => {
      await tx.skill.delete({ where: { id } });
      await logActivity(tx, admin.id, "skill.delete", "skill", id);
    });
    await revalidateContent("skill");
    return new NextResponse(null, { status: 204 });
  });
}
