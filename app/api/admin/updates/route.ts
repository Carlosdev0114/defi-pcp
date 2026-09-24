import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withErrors, parseQuery } from "@/lib/server/api";
import { requireAdminSession, unauthorized } from "@/lib/server/guard";
import { getAdminVersion } from "@/lib/server/realtime";

const querySchema = z.object({ since: z.coerce.number().int().min(0).optional() });

/**
 * Polling admin (toutes les 10 s). Version inchangée → réponse immédiate,
 * sans aucune requête PostgreSQL (session vérifiée par JWT + Redis). Sinon :
 * compteurs de non-lus, et le client recharge ce qu'il affiche.
 */
export function GET(req: NextRequest) {
  return withErrors("GET /api/admin/updates", async () => {
    if (!(await requireAdminSession())) return unauthorized();
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;

    const version = await getAdminVersion();
    if (q.since !== undefined && version !== null && version === q.since) {
      return NextResponse.json({ changed: false, version });
    }

    const [notifications, messages] = await Promise.all([
      db.notification.count({ where: { read: false } }),
      db.notification.count({ where: { read: false, type: "message" } }),
    ]);
    return NextResponse.json({ changed: true, version: version ?? 0, unread: { notifications, messages } });
  });
}
