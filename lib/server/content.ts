import "server-only";
import { db } from "@/lib/server/db";
import { withMediaUrl } from "@/lib/server/storage";

// Lectures du contenu PUBLIÉ pour les pages publiques (Server Components).
// Publié = `publishedAt` renseigné ET atteint : un brouillon ou un contenu
// dépublié n'est jamais renvoyé (les pages répondent alors 404).

export const publishedNow = () => ({ publishedAt: { not: null, lte: new Date() } });

const mediaSelect = { url: true, altText: true, width: true, height: true } as const;
type MediaRow = { url: string; altText: string | null; width: number | null; height: number | null };
const toMedia = (m: MediaRow) => withMediaUrl(m);

export async function getPublishedProjects(take?: number) {
  const rows = await db.project.findMany({
    where: publishedNow(),
    orderBy: [{ featured: "desc" }, { order: "asc" }, { publishedAt: "desc" }],
    select: {
      slug: true,
      title: true,
      summary: true,
      techStack: true,
      publishedAt: true,
      media: { select: mediaSelect, orderBy: { createdAt: "asc" }, take: 1 },
    },
    ...(take ? { take } : {}),
  });
  return rows.map((p) => ({ ...p, cover: p.media[0] ? toMedia(p.media[0]) : null }));
}

export async function getPublishedProject(slug: string) {
  const p = await db.project.findFirst({
    where: { slug, ...publishedNow() },
    include: { media: { select: mediaSelect, orderBy: { createdAt: "asc" } } },
  });
  return p ? { ...p, media: p.media.map(toMedia) } : null;
}

export async function getPublishedArticles(take?: number) {
  const rows = await db.article.findMany({
    where: publishedNow(),
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, excerpt: true, content: true, publishedAt: true },
    ...(take ? { take } : {}),
  });
  // Le contenu ne sert qu'au temps de lecture : il n'est pas renvoyé tel quel.
  return rows.map(({ content, ...a }) => ({ ...a, readMinutes: readingMinutes(content) }));
}

export async function getPublishedArticle(slug: string) {
  const a = await db.article.findFirst({
    where: { slug, ...publishedNow() },
    include: { coverMedia: { select: mediaSelect } },
  });
  return a ? { ...a, coverMedia: a.coverMedia ? toMedia(a.coverMedia) : null, readMinutes: readingMinutes(a.content) } : null;
}

export function getExperiences() {
  return db.experience.findMany({ orderBy: [{ order: "asc" }, { startDate: "desc" }] });
}

export function getSkills() {
  return db.skill.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
}

/** Slugs publiés (génération statique des pages de détail, routes connues des visites). */
export async function getPublishedSlugs() {
  const [projects, articles] = await Promise.all([
    db.project.findMany({ where: publishedNow(), select: { slug: true } }),
    db.article.findMany({ where: publishedNow(), select: { slug: true } }),
  ]);
  return { projects: projects.map((p) => p.slug), articles: articles.map((a) => a.slug) };
}

/** Temps de lecture estimé (≈ 200 mots/min, arrondi, 1 min minimum). */
export function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
