import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody } from "@/lib/server/api";
import { getModules, getSettings, revalidateSiteConfig, setModules, setSettings } from "@/lib/server/site-config";
import { modulesSchema, settingsSchema } from "@/lib/schemas/site";

const bodySchema = z.object({ settings: settingsSchema, modules: modulesSchema }).strict();

/** Paramètres (privés) et modules actifs (publics). */
export function GET() {
  return withAdmin("GET /api/admin/settings", async () => {
    const [settings, modules] = await Promise.all([getSettings(), getModules()]);
    return NextResponse.json({ settings, modules });
  });
}

export function PUT(req: NextRequest) {
  return withAdmin("PUT /api/admin/settings", async (admin) => {
    const { data, error } = await parseJsonBody(req, bodySchema);
    if (error) return error;
    const [settings, modules] = await Promise.all([setSettings(data.settings), setModules(data.modules)]);
    await db.activity.create({ data: { userId: admin.id, action: "settings.update", entity: "settings" } });
    // Modules : widget du chatbot et page de réservation, sur tout le site public.
    revalidateSiteConfig("modules");
    revalidatePath("/", "layout");
    return NextResponse.json({ settings, modules });
  });
}
