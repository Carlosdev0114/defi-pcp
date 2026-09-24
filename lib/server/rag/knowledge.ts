import { db } from "@/lib/server/db";
import { getProfile } from "@/lib/server/site-config";
import { publishedNow } from "@/lib/server/content";

// Base de connaissances = uniquement des données PUBLIQUES : contenus publiés
// en base (projets, articles), parcours, compétences, services actifs, et le
// profil affiché sur le site. Jamais de leads, messages, RDV ni e-mails privés.

export type KnowledgeDoc = { source: string; title: string; text: string };
export type Chunk = KnowledgeDoc & { id: string };

const MAX_CHUNK = 900;

const fmtMonth = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);

export async function loadKnowledge(): Promise<KnowledgeDoc[]> {
  const [projects, experiences, skills, articles, services, profile] = await Promise.all([
    db.project.findMany({ where: publishedNow(), orderBy: { order: "asc" } }),
    db.experience.findMany({ orderBy: { startDate: "desc" } }),
    db.skill.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }),
    db.article.findMany({ where: publishedNow(), orderBy: { publishedAt: "desc" } }),
    db.service.findMany({ where: { active: true } }),
    getProfile(),
  ]);

  // Profil public (Redis) : seules les informations renseignées sont indexées.
  const docs: KnowledgeDoc[] = [];
  const profileText = [
    [profile.name, profile.role].filter(Boolean).join(", "),
    profile.baseline,
    profile.shortBio,
    profile.location ? `Localisation : ${profile.location}.` : "",
    [
      profile.email && `E-mail : ${profile.email}`,
      profile.socials.github && `GitHub : ${profile.socials.github}`,
      profile.socials.linkedin && `LinkedIn : ${profile.socials.linkedin}`,
    ]
      .filter(Boolean)
      .join(". "),
  ].filter(Boolean);
  if (profileText.length) {
    docs.push({ source: "profil", title: `Profil${profile.name ? ` — ${profile.name}` : ""}`, text: profileText.join("\n\n") });
  }

  for (const p of projects) {
    docs.push({
      source: `projet:${p.slug}`,
      title: `Projet — ${p.title}`,
      text: [
        p.summary,
        p.role ? `Rôle : ${p.role}.` : "",
        p.techStack.length ? `Stack : ${p.techStack.join(", ")}.` : "",
        p.description,
        p.liveUrl ? `En ligne : ${p.liveUrl}` : "",
      ].filter(Boolean).join("\n\n"),
    });
  }

  for (const x of experiences) {
    const period = `${fmtMonth(x.startDate)} — ${x.endDate ? fmtMonth(x.endDate) : "aujourd'hui"}`;
    docs.push({
      source: `experience:${x.id}`,
      title: `Expérience — ${x.title} chez ${x.company}`,
      text: [`${x.title} chez ${x.company}${x.location ? ` (${x.location})` : ""}, ${period}.`, x.description].join("\n\n"),
    });
  }

  const byCategory = new Map<string, string[]>();
  for (const s of skills) {
    byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), `${s.name} (niveau ${s.level}/5)`]);
  }
  for (const [category, names] of byCategory) {
    docs.push({ source: `competences:${category}`, title: `Compétences — ${category}`, text: names.join(", ") + "." });
  }

  for (const a of articles) {
    docs.push({ source: `article:${a.slug}`, title: `Article — ${a.title}`, text: [a.excerpt, a.content].join("\n\n") });
  }

  for (const s of services) {
    docs.push({
      source: `service:${s.id}`,
      title: `Service — ${s.name}`,
      text: `${s.name} : ${s.durationMin} minutes. ${s.description ?? ""} Réservable sur la page /reservation.`,
    });
  }

  return docs;
}

/** Découpe par paragraphes (puis par phrases si un paragraphe est trop long)
 * en morceaux de ~900 caractères, chacun préfixé par le titre du document
 * pour garder son contexte une fois isolé. */
export function chunkDocs(docs: KnowledgeDoc[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const doc of docs) {
    const pieces = doc.text
      .split(/\n\s*\n/)
      .flatMap((para) => (para.length <= MAX_CHUNK ? [para] : para.match(/[^.!?]+[.!?]*\s*/g) ?? [para]))
      .map((p) => p.trim())
      .filter(Boolean);

    let current = "";
    let n = 0;
    const flush = () => {
      if (!current) return;
      chunks.push({ ...doc, id: `${doc.source}#${n++}`, text: `${doc.title}\n${current}` });
      current = "";
    };
    for (const piece of pieces) {
      if (current && current.length + piece.length + 1 > MAX_CHUNK) flush();
      current = current ? `${current}\n${piece}` : piece.slice(0, MAX_CHUNK * 2);
    }
    flush();
  }
  return chunks;
}
