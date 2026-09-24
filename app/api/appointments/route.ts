import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { getModules } from "@/lib/server/site-config";
import { withErrors, parseJsonBody, apiError } from "@/lib/server/api";
import { getClientIp } from "@/lib/server/client-ip";
import { bookingSchema } from "@/lib/server/validation";
import { checkLimits, tooManyRequests } from "@/lib/server/rate-limit";
import { checkSlot, type SlotCheck } from "@/lib/server/booking";
import { invalidate } from "@/lib/server/cache";
import { notify } from "@/lib/server/audit";
import { bumpAdminVersion } from "@/lib/server/realtime";
import { appointmentReference } from "@/lib/booking/status";

type Refusal = Extract<SlotCheck, { ok: false }>["reason"];

/** Réponses d'erreur, du plus précis au plus générique. */
const REFUSALS: Record<Refusal, [number, string]> = {
  service: [404, "Service introuvable."],
  past: [400, "Ce créneau est déjà passé (réservation au moins 1 h à l'avance)."],
  outside: [400, "Ce créneau est en dehors des horaires proposés ou au-delà de 60 jours."],
  taken: [409, "Ce créneau n'est plus disponible. Choisissez-en un autre."],
};

const isSerializationFailure = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";

/**
 * Réservation visiteur, atomique. La vérification du créneau (horaires,
 * blocages, RDV existants) et la création se font dans UNE transaction
 * SERIALIZABLE : si deux visiteurs visent le même créneau en même temps,
 * PostgreSQL fait échouer l'une des transactions (P2034). Elle est rejouée
 * une fois — elle voit alors le RDV de l'autre et répond 409 — puis refusée.
 * (Pas de contrainte d'unicité possible : deux RDV peuvent se chevaucher
 * sans commencer à la même heure.)
 */
export function POST(req: NextRequest) {
  return withErrors("POST /api/appointments", async () => {
    const { data, error } = await parseJsonBody(req, bookingSchema);
    if (error) return error;
    if (!(await getModules()).booking) return apiError("La réservation en ligne est momentanément fermée.", 503);

    const limit = await checkLimits([["booking", getClientIp(req.headers)]]);
    if (!limit.success) return tooManyRequests(limit.reset);

    const startAt = new Date(data.startAt);
    const book = () =>
      db.$transaction(
        async (tx) => {
          const slot = await checkSlot(tx, data.serviceId, startAt);
          if (!slot.ok) return { refused: slot.reason };

          const service = await tx.service.findUniqueOrThrow({ where: { id: data.serviceId }, select: { name: true } });
          const appointment = await tx.appointment.create({
            data: {
              serviceId: data.serviceId,
              visitorName: data.visitorName,
              visitorEmail: data.visitorEmail.toLowerCase(),
              startAt,
              endAt: slot.endAt,
              notes: data.notes || null,
            },
            select: { id: true, startAt: true, endAt: true, status: true },
          });
          await notify(tx, "booking", {
            appointmentId: appointment.id,
            name: data.visitorName,
            service: service.name,
            startAt: appointment.startAt.toISOString(),
          });
          return { appointment, service: service.name };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

    let result: Awaited<ReturnType<typeof book>>;
    try {
      result = await book();
    } catch (err) {
      if (!isSerializationFailure(err)) throw err;
      try {
        result = await book();
      } catch (retryErr) {
        if (!isSerializationFailure(retryErr)) throw retryErr;
        result = { refused: "taken" };
      }
    }

    if (result.refused) {
      const [status, message] = REFUSALS[result.refused];
      return apiError(message, status);
    }

    await Promise.all([invalidate("slots"), bumpAdminVersion()]);
    const { appointment } = result;
    if (!appointment) throw new Error("Réservation sans rendez-vous créé.");
    return NextResponse.json(
      {
        ok: true,
        appointment: {
          reference: appointmentReference(appointment.id),
          status: appointment.status,
          startAt: appointment.startAt,
          endAt: appointment.endAt,
          service: result.service,
        },
      },
      { status: 201 }
    );
  });
}
