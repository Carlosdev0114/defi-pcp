import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { LinkButton, SectionLabel } from "@/components/ui/buttons";
import { getSkills } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Compétences",
  description: "Compétences techniques, par famille.",
};

export default async function SkillsPage() {
  const skills = await getSkills();
  const categories = [...new Set(skills.map((s) => s.category))];

  return (
    <>
      <PageHeader
        index="02"
        label="Compétences"
        title={
          <>
            Ce que je fais bien <span className="text-accent">(et le reste).</span>
          </>
        }
        lead="Une fiche de compétences honnête : ce que je pratique au quotidien, ce que je peux maintenir sans paniquer, et ce que je délègue à quelqu'un de meilleur."
      />

      <section className="page-pad mx-auto max-w-6xl py-16">
        <div className="grid gap-10 md:grid-cols-2">
          {categories.map((category, i) => (
            <div key={category} className={i % 2 ? "md:pl-8" : ""}>
              <SectionLabel index={String(i + 1).padStart(2, "0")}>{category}</SectionLabel>
              <ul className="mt-5 divide-y divide-line border-y border-line">
                {skills
                  .filter((s) => s.category === category)
                  .map((skill) => (
                    <li key={skill.id} className="py-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="font-medium">{skill.name}</p>
                        <p className="font-mono text-xs text-ink-soft">{skill.level}/5</p>
                      </div>
                      <div className="mt-2 grid grid-cols-5 gap-1" role="img" aria-label={`Niveau ${skill.level} sur 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={n <= skill.level ? "h-2 bg-accent" : "h-2 border border-line-strong bg-paper"} />
                        ))}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-6 border-2 border-ink bg-cream p-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-lg leading-relaxed">
            <span className="font-display">Toujours en train d'apprendre :</span> Rust par petites pièces, l'observabilité (elle me fait encore peur), et la patience.
          </p>
          <LinkButton href="/projets" variant="accent" className="shrink-0">
            Voir ces compétences en action
          </LinkButton>
        </div>
      </section>
    </>
  );
}
