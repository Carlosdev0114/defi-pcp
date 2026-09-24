import "server-only";
import { revalidatePath } from "next/cache";
import { invalidate } from "@/lib/server/cache";
import { markRagStale } from "@/lib/server/rag/index";
import { resetKnownPaths } from "@/lib/server/visits";

// Après toute écriture admin sur un contenu public (création, modification,
// suppression, publication, dépublication) : pages statiques à régénérer
// (à leur prochaine visite), cache Redis des API publiques, index du chatbot
// marqué périmé, liste des routes connues des visites.

export type ContentKind = "project" | "article" | "experience" | "skill" | "media" | "profile";

/** Chemins publics touchés par un type de contenu (pur, testable). */
export function pathsFor(kind: ContentKind, slugs: (string | null | undefined)[] = []): string[] {
  const unique = [...new Set(slugs.filter((s): s is string => Boolean(s)))];
  switch (kind) {
    case "project":
      return ["/", "/projets", ...unique.map((s) => `/projets/${s}`)];
    case "article":
      return ["/", "/articles", ...unique.map((s) => `/articles/${s}`)];
    case "experience":
      return ["/parcours"];
    case "skill":
      return ["/competences"];
    case "media": // couvertures des projets et des articles
      return ["/", "/projets", "/articles"];
    case "profile": // nom et coordonnées dans l'en-tête, le pied de page, etc.
      return [];
  }
}

const CACHE: Partial<Record<ContentKind, ("projects" | "articles" | "experiences" | "skills")[]>> = {
  project: ["projects"],
  article: ["articles"],
  experience: ["experiences"],
  skill: ["skills"],
  media: ["projects", "articles"],
};

export async function revalidateContent(kind: ContentKind, slugs: (string | null | undefined)[] = []) {
  if (kind === "profile") revalidatePath("/", "layout"); // tout le site public
  for (const path of pathsFor(kind, slugs)) revalidatePath(path);
  if (kind === "media") {
    revalidatePath("/projets/[slug]", "page");
    revalidatePath("/articles/[slug]", "page");
  }
  if (kind === "project" || kind === "article") resetKnownPaths();
  // Les médias n'entrent pas dans la base de connaissances du chatbot.
  await Promise.all([invalidate(...(CACHE[kind] ?? [])), kind === "media" ? null : markRagStale()]);
}
