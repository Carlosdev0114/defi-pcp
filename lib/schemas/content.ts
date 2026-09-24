import { z } from "zod";

// Schémas des contenus éditoriaux, partagés par les formulaires admin
// (validation immédiate) et par les routes API (validation qui fait foi).
// `.strict()` : aucun champ inconnu (pas d'affectation de masse).

const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, label: string) => z.string().trim().min(1, `${label} requis.`).max(max);
export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug requis.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (a-z, 0-9, tirets).");
const url = z.url({ protocol: /^https?$/, error: "URL http(s) invalide." }).max(500);
const isoDateTime = z.iso.datetime({ offset: true });
const order = z.number().int().min(0).max(10_000);

export const projectCreateSchema = z
  .object({
    slug: slugSchema,
    title: requiredText(120, "Titre"),
    summary: requiredText(300, "Résumé"),
    description: requiredText(20_000, "Description"),
    techStack: z.array(text(40).min(1)).max(20).default([]),
    role: text(120).nullish(),
    liveUrl: url.nullish(),
    repoUrl: url.nullish(),
    featured: z.boolean().default(false),
    order: order.default(0),
    publishedAt: isoDateTime.nullish(),
  })
  .strict();
export const projectUpdateSchema = projectCreateSchema.partial().strict();

const experienceFields = {
  company: requiredText(120, "Entreprise"),
  title: requiredText(120, "Poste"),
  location: text(120).nullish(),
  startDate: isoDateTime,
  endDate: isoDateTime.nullish(),
  description: requiredText(10_000, "Description"),
};
export const experienceCreateSchema = z
  .object({ ...experienceFields, order: order.default(0) })
  .strict()
  .refine((v) => !v.endDate || new Date(v.endDate) >= new Date(v.startDate), {
    message: "La date de fin précède la date de début.",
    path: ["endDate"],
  });
export const experienceUpdateSchema = z.object({ ...experienceFields, order }).partial().strict();

export const skillCreateSchema = z
  .object({
    name: requiredText(80, "Nom"),
    category: requiredText(60, "Catégorie"),
    level: z.number().int().min(1).max(5).default(3),
    order: order.default(0),
  })
  .strict();
export const skillUpdateSchema = skillCreateSchema.partial().strict();

export const articleCreateSchema = z
  .object({
    slug: slugSchema,
    title: requiredText(160, "Titre"),
    excerpt: requiredText(400, "Extrait"),
    content: requiredText(50_000, "Contenu"),
    coverMediaId: z.string().max(64).nullish(),
    publishedAt: isoDateTime.nullish(),
  })
  .strict();
export const articleUpdateSchema = articleCreateSchema.partial().strict();

export const mediaUpdateSchema = z
  .object({
    altText: text(200).nullish(),
    projectId: z.string().max(64).nullish(),
  })
  .strict();

export type ProjectInput = z.infer<typeof projectCreateSchema>;
export type ArticleInput = z.infer<typeof articleCreateSchema>;
export type ExperienceInput = z.infer<typeof experienceCreateSchema>;
export type SkillInput = z.infer<typeof skillCreateSchema>;
