import { z } from "./zod.ts";

// Schéma du formulaire de contact, partagé par le formulaire (validation
// immédiate, messages par champ) et par POST /api/contact (validation qui
// fait foi). Une seule définition : les deux côtés ne peuvent pas diverger.

export const CONTACT_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  subjectMax: 160,
  messageMin: 10,
  messageMax: 5000,
} as const;

export const contactSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(CONTACT_LIMITS.nameMin, "Nom trop court.")
      .max(CONTACT_LIMITS.nameMax, "Nom trop long."),
    email: z.email({ error: "Adresse e-mail invalide." }).max(254),
    subject: z.string().trim().max(CONTACT_LIMITS.subjectMax, "Sujet trop long.").optional(),
    message: z
      .string()
      .trim()
      .min(CONTACT_LIMITS.messageMin, `Message trop court (${CONTACT_LIMITS.messageMin} caractères minimum).`)
      .max(CONTACT_LIMITS.messageMax, "Message trop long."),
    // Pot de miel : champ invisible pour un humain, rempli par les bots.
    website: z.string().max(200).optional(),
  })
  .strict();

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactField = keyof ContactInput;
