import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors, parseJsonBody } from "@/lib/server/api";
import { checkLimits, GLOBAL_KEY } from "@/lib/server/rate-limit";
import { isBot, knownPath, recordVisit } from "@/lib/server/visits";

const visitSchema = z.object({ path: z.string().max(200) }).strict();
const noContent = () => new NextResponse(null, { status: 204 });

/**
 * Beacon de page vue (navigator.sendBeacon). Réponse toujours 204 : le
 * navigateur n'en fait rien et un robot n'apprend pas ce qui est compté.
 * Plafond GLOBAL (aucune IP en jeu) contre le gonflement des compteurs.
 */
export function POST(req: NextRequest) {
  return withErrors("POST /api/public/visit", async () => {
    const { data, error } = await parseJsonBody(req, visitSchema, 1024);
    if (error) return error;

    const path = await knownPath(data.path);
    if (!path || isBot(req.headers.get("user-agent"))) return noContent();

    const limit = await checkLimits([["visitGlobal", GLOBAL_KEY]]);
    if (!limit.success) return noContent();

    await recordVisit(path);
    return noContent();
  });
}
