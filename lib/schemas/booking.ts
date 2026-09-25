import { z } from "./zod.ts";

// Schéma de réservation, partagé par le formulaire (étape « Coordonnées ») et
// par POST /api/appointments. Une seule définition : les deux côtés ne peuvent
// pas diverger.

export const BOOKING_LIMITS = { nameMin: 2, nameMax: 120, notesMax: 2000 } as const;

export const bookingSchema = z
  .object({
    serviceId: z.string().min(1, "Service requis.").max(64),
    startAt: z.iso.datetime({ offset: true, error: "Créneau invalide (format de date attendu : ISO 8601)." }),
    visitorName: z
      .string()
      .trim()
      .min(BOOKING_LIMITS.nameMin, "Nom trop court.")
      .max(BOOKING_LIMITS.nameMax, "Nom trop long."),
    visitorEmail: z.email({ error: "Adresse e-mail invalide." }).max(254),
    notes: z.string().trim().max(BOOKING_LIMITS.notesMax, "Message trop long.").optional(),
  })
  .strict();

export type BookingInput = z.infer<typeof bookingSchema>;

/** Sous-ensemble validé à l'étape « Coordonnées » du formulaire. */
export const bookingVisitorSchema = bookingSchema.pick({ visitorName: true, visitorEmail: true, notes: true });
