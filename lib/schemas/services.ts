import { z } from "./zod.ts";

// Services réservables et leur planning hebdomadaire. Partagés par l'écran
// admin (validation côté client) et les routes /api/admin/services (serveur).

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (HH:MM).");

export const serviceCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Nom requis.").max(120),
    durationMin: z.number().int().min(15).max(8 * 60),
    description: z.string().trim().max(2000).nullish(),
    active: z.boolean().default(true),
  })
  .strict();
export const serviceUpdateSchema = serviceCreateSchema.partial().strict();

export const availabilityReplaceSchema = z
  .object({
    slots: z
      .array(
        z
          .object({ weekday: z.number().int().min(0).max(6), startTime: hhmm, endTime: hhmm })
          .strict()
          .refine((s) => s.startTime < s.endTime, "Plage horaire vide ou inversée."),
      )
      .max(50),
  })
  .strict();

export type AvailabilitySlot = z.infer<typeof availabilityReplaceSchema>["slots"][number];
