import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getModules } from "@/lib/server/site-config";
import { withErrors, parseQuery, apiError } from "@/lib/server/api";
import { slotsQuerySchema } from "@/lib/server/validation";
import { cached } from "@/lib/server/cache";
import { getAvailableSlots, BOOKING_TZ } from "@/lib/server/booking";

/** Créneaux libres d'un service pour une date (fuseau Europe/Paris). Cache
 * court (60 s) ; toute réservation ou modif d'agenda l'invalide. La
 * disponibilité est de toute façon revérifiée à la réservation. */
export function GET(req: NextRequest) {
  return withErrors("GET /api/public/slots", async () => {
    const { data: q, error } = parseQuery(req, slotsQuerySchema);
    if (error) return error;
    if (!(await getModules()).booking) return apiError("La réservation en ligne est momentanément fermée.", 503);
    const slots = await cached("slots", `${q.serviceId}:${q.date}`, () => getAvailableSlots(db, q.serviceId, q.date), 60);
    if (slots === null) return apiError("Service introuvable.", 404);
    return NextResponse.json({ date: q.date, timeZone: BOOKING_TZ, items: slots });
  });
}
