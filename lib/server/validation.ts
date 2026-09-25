import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/crm/stages";

// Tous les schémas d'entrée des routes API. `.strict()` refuse les champs
// inconnus (pas d'affectation de masse, ex. forcer `role` ou `id`).

const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} requis.`).max(max);
const isoDateTime = z.iso.datetime({ offset: true });

// --- Auth -------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.email({ error: "Adresse e-mail invalide." }).max(254),
  // Borne haute : bcrypt ignore au-delà de 72 octets, et on évite de hasher
  // des charges arbitrairement grandes.
  password: z.string().min(8, "Mot de passe trop court.").max(128, "Mot de passe trop long."),
});

export type LoginInput = z.infer<typeof loginSchema>;

// --- Contenu ------------------------------------------------------------------
// Schémas partagés avec les formulaires admin (validation client ET serveur).
export {
  projectCreateSchema,
  projectUpdateSchema,
  experienceCreateSchema,
  experienceUpdateSchema,
  skillCreateSchema,
  skillUpdateSchema,
  articleCreateSchema,
  articleUpdateSchema,
  mediaUpdateSchema,
} from "@/lib/schemas/content";

// --- Services & agenda ------------------------------------------------------

// Partagés avec l'écran admin des services (validation client ET serveur).
export { serviceCreateSchema, serviceUpdateSchema, availabilityReplaceSchema } from "@/lib/schemas/services";

export const calendarEventCreateSchema = z
  .object({
    title: requiredText(160, "Titre"),
    startAt: isoDateTime,
    endAt: isoDateTime,
    blocked: z.boolean().default(true),
  })
  .strict()
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), {
    message: "La fin doit suivre le début.",
    path: ["endAt"],
  });

export const appointmentStatusSchema = z
  .object({
    status: z.enum(["CONFIRMED", "DECLINED", "CANCELLED", "COMPLETED"]),
    notes: text(2000).nullish(),
  })
  .strict();

export const rangeQuerySchema = z.object({
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
});

// --- CRM ----------------------------------------------------------------------

// Même liste que la table des stades (lib/crm/stages.ts) : une seule source.
export const leadStatusEnum = z.enum(LEAD_STATUSES);

export const leadPromoteSchema = z
  .object({
    value: z.number().int().min(0).max(10_000_000).nullish(),
    source: text(120).nullish(),
  })
  .strict();

export const leadUpdateSchema = z
  .object({
    status: leadStatusEnum.optional(),
    value: z.number().int().min(0).max(10_000_000).nullish(),
    source: text(120).nullish(),
  })
  .strict();

export const leadNoteSchema = z.object({ content: requiredText(5000, "Note") }).strict();

// --- Messagerie & notifications ----------------------------------------------

// Schéma partagé avec le widget visiteur et l'écran admin (lib/schemas/message).
export { messageSchema as adminMessageSchema } from "@/lib/schemas/message";

export const notificationsReadSchema = z
  .object({ ids: z.array(z.string().max(64)).max(100).optional(), all: z.boolean().optional() })
  .strict()
  .refine((v) => v.all || (v.ids && v.ids.length > 0), "Préciser `ids` ou `all`.");

// --- Public -----------------------------------------------------------------

// Schéma partagé avec le formulaire du site (validation client ET serveur).
export { contactSchema } from "@/lib/schemas/contact";

export const slotsQuerySchema = z.object({
  serviceId: z.string().min(1).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)."),
});

// Schéma partagé avec le formulaire de réservation (validation client ET serveur).
export { bookingSchema } from "@/lib/schemas/booking";

/** Vue d'ensemble des disponibilités : `days` jours à partir de `from`. */
export const availabilityQuerySchema = z.object({
  serviceId: z.string().min(1).max(64),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ).").optional(),
  days: z.coerce.number().int().min(1).max(60).default(14),
});

export const chatSchema = z
  .object({
    question: requiredText(500, "Question"),
  })
  .strict();
