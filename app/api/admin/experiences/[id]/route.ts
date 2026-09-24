import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseId, apiError, toDate } from "@/lib/server/api";
import { experienceUpdateSchema } from "@/lib/server/validation";
import { logActivity } from "@/lib/server/audit";
import { revalidateContent } from "@/lib/server/revalidate";

type Ctx = RouteContext<"/api/admin/experiences/[id]">;

export function PATCH(req: NextRequest, ctx: Ctx) {
  return withAdmin("PATCH /api/admin/experiences/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, experienceUpdateSchema, 32 * 1024);
    if (error) return error;

    const experience = await db.$transaction(async (tx) => {
      const current = await tx.experience.findUniqueOrThrow({ where: { id } });
      const startDate = data.startDate ? new Date(data.startDate) : current.startDate;
      const endDate = data.endDate === undefined ? current.endDate : toDate(data.endDate);
      if (endDate && endDate < startDate) return null;
      const updated = await tx.experience.update({ where: { id }, data: { ...data, startDate, endDate } });
      await logActivity(tx, admin.id, "experience.update", "experience", id);
      return updated;
    });
    if (!experience) return apiError("La date de fin précède la date de début.", 400);

    await revalidateContent("experience");
    return NextResponse.json(experience);
  });
}

export function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAdmin("DELETE /api/admin/experiences/[id]", async (admin) => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    await db.$transaction(async (tx) => {
      await tx.experience.delete({ where: { id } });
      await logActivity(tx, admin.id, "experience.delete", "experience", id);
    });
    await revalidateContent("experience");
    return new NextResponse(null, { status: 204 });
  });
}
