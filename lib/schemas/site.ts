import { z } from "@/lib/schemas/zod";

// Configuration du site sans modèle Prisma (schéma imposé) : stockée en JSON
// dans Redis (voir DATABASE.md). Chaque document est validé à l'écriture ET à
// la lecture ; une valeur absente ou corrompue retombe sur les défauts.
//
// PUBLIC  (lisible par les pages publiques) : profil, modules actifs.
// PRIVÉ   (back-office uniquement) : paramètres, réglages de l'assistant.

const text = (max: number) => z.string().trim().max(max);

export const profileSchema = z
  .object({
    name: text(120),
    role: text(160),
    baseline: text(300),
    shortBio: text(1500),
    email: z.union([z.literal(""), z.email({ error: "Adresse e-mail invalide." }).max(254)]),
    phone: text(40),
    location: text(160),
    socials: z
      .object({
        github: text(200),
        linkedin: text(200),
        mastodon: text(200),
      })
      .strict(),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
export const DEFAULT_PROFILE: Profile = {
  name: "",
  role: "",
  baseline: "",
  shortBio: "",
  email: "",
  phone: "",
  location: "",
  socials: { github: "", linkedin: "", mastodon: "" },
};

/** Modules activables : lus par les routes publiques pour s'appliquer. */
export const modulesSchema = z.object({ booking: z.boolean(), chat: z.boolean() }).strict();
export type Modules = z.infer<typeof modulesSchema>;
export const DEFAULT_MODULES: Modules = { booking: true, chat: true };

export const settingsSchema = z.object({ siteName: text(120).min(1, "Nom du site requis.") }).strict();
export type Settings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: Settings = { siteName: "Back-office" };

/** Réglages de l'assistant. Les règles anti-injection restent dans le code :
 * les consignes de l'admin s'AJOUTENT après elles et ne peuvent pas les lever. */
export const assistantSchema = z
  .object({
    temperature: z.number().min(0).max(1),
    maxChunks: z.number().int().min(1).max(8),
    extraInstructions: text(1000),
  })
  .strict();
export type AssistantConfig = z.infer<typeof assistantSchema>;
export const DEFAULT_ASSISTANT: AssistantConfig = { temperature: 0.2, maxChunks: 4, extraInstructions: "" };
