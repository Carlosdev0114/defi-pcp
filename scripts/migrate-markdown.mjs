import { PrismaClient } from "@prisma/client";

// Migration ponctuelle (phase 3D) : les descriptions de projets et
// d'expériences créées par l'ancien seed étaient en texte brut à titres nus
// (« Contexte\n… ») et puces « • ». Le site les rend désormais en Markdown :
// on convertit la MISE EN FORME uniquement, le texte (y compris des
// modifications faites depuis le back-office) est conservé tel quel.
// Idempotent : un contenu déjà converti n'est plus reconnu comme ancien format.
//
//   node --env-file=.env scripts/migrate-markdown.mjs

const db = new PrismaClient();

const HEADINGS = {
  Contexte: "Contexte",
  Problème: "Le problème",
  "Ce qui a été fait": "Ce qui a été fait",
  Résultat: "Le résultat",
  "Chiffres clés": "Chiffres clés",
};

export function legacyProjectToMarkdown(text) {
  if (!text.startsWith("Contexte\n")) return null;
  return text
    .split("\n\n")
    .map((block) => {
      const [first, ...rest] = block.split("\n");
      const title = HEADINGS[first];
      if (!title) return block;
      const body = title === "Chiffres clés" ? rest.map((l) => `- ${l}`).join("\n") : rest.join("\n");
      return `## ${title}\n\n${body}`;
    })
    .join("\n\n");
}

export function legacyExperienceToMarkdown(text) {
  const lines = text.split("\n");
  if (!lines.some((l) => l.startsWith("• "))) return null;
  const bullets = lines.filter((l) => l.startsWith("• ")).map((l) => `- ${l.slice(2)}`);
  const others = lines.filter((l) => !l.startsWith("• "));
  const stack = others.filter((l) => l.startsWith("Stack : "));
  const summary = others.filter((l) => !l.startsWith("Stack : "));
  return [summary.join("\n"), bullets.join("\n"), ...stack].filter(Boolean).join("\n\n");
}

async function main() {
  let projects = 0;
  for (const p of await db.project.findMany({ select: { id: true, description: true } })) {
    const md = legacyProjectToMarkdown(p.description);
    if (md === null) continue;
    await db.project.update({ where: { id: p.id }, data: { description: md } });
    projects++;
  }
  let experiences = 0;
  for (const x of await db.experience.findMany({ select: { id: true, description: true } })) {
    const md = legacyExperienceToMarkdown(x.description);
    if (md === null) continue;
    await db.experience.update({ where: { id: x.id }, data: { description: md } });
    experiences++;
  }
  console.log(`Markdown : ${projects} projet(s), ${experiences} expérience(s) converti(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
