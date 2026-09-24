import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseId, apiError } from "@/lib/server/api";
import { bumpAdminVersion } from "@/lib/server/realtime";

/**
 * Marque comme lus les messages d'une conversation. Message n'a pas de champ
 * « lu » (schéma imposé) : l'état vit dans les notifications `message` de la
 * conversation. Cet état est commun à tous les admins (voir SECURITY.md).
 */
export function POST(_req: NextRequest, ctx: RouteContext<"/api/admin/conversations/[id]/read">) {
  return withAdmin("POST /api/admin/conversations/[id]/read", async () => {
    const id = parseId((await ctx.params).id);
    if (!id) return apiError("Identifiant invalide.", 400);
    const { count } = await db.notification.updateMany({
      where: { type: "message", read: false, payload: { path: ["conversationId"], equals: id } },
      data: { read: true },
    });
    if (count) await bumpAdminVersion();
    return NextResponse.json({ updated: count });
  });
}
