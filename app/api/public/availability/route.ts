import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getModules } from "@/lib/server/site-config";
import { withErrors, parseQuery, apiError } from "@/lib/server/api";
import { availabilityQuerySchema } from "@/lib/server/validation";
import { cached } from "@/lib/server/cache";
import { getAvailabilitySummary, BOOKING_TZ } from "@/lib/server/booking";
import { isRealDate, localDate } from "@/lib/time/paris";

/**
 * Vue d'ensemble : nombre de créneaux libres par jour (défaut 14 jours, max
 * 60), calculée en une passe. Cache 60 s, invalidé par toute réservation ou
 * modification d'agenda. Les créneaux d'un jour : /api/public/slots.
 */
export function GET(req: NextRequest) {
  return withErrors("GET /api/public/availability", async () => {
    const { data: q, error } = parseQuery(req, availabilityQuerySchema);
    if (error) return error;
    if (!(await getModules()).booking) return apiError("La réservation en ligne est momentanément fermée.", 503);
    const from = q.from ?? localDate(new Date());
    if (!isRealDate(from)) return apiError("Date invalide (AAAA-MM-JJ).", 400);

    const days = await cached(
      "slots",
      `avail:${q.serviceId}:${from}:${q.days}`,
      () => getAvailabilitySummary(db, q.serviceId, from, q.days),
      60
    );
    if (days === null) return apiError("Service introuvable.", 404);
    return NextResponse.json({ from, timeZone: BOOKING_TZ, items: days });
  });
}
