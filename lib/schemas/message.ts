import { z } from "@/lib/schemas/zod";

// Schémas de la messagerie, partagés par le widget visiteur, l'écran admin et
// les routes API. `.strict()` : tout champ en trop (dont un identifiant de
// conversation) est refusé — la conversation est désignée par le cookie.

export const MESSAGE_MAX = 2000;

export const messageContent = z
  .string()
  .trim()
  .min(1, "Le message est vide.")
  .max(MESSAGE_MAX, `Message trop long (${MESSAGE_MAX} caractères maximum).`);

export const messageSchema = z.object({ content: messageContent }).strict();

export const startConversationSchema = z
  .object({
    visitorName: z.string().trim().max(120, "Nom trop long.").optional(),
    visitorEmail: z.email({ error: "Adresse e-mail invalide." }).max(254).optional(),
    content: messageContent,
  })
  .strict();

export type StartConversationInput = z.infer<typeof startConversationSchema>;
