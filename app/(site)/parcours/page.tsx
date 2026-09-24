import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { Markdown } from "@/components/content/Markdown";
import { getExperiences } from "@/lib/server/content";
import { formatPeriod } from "@/lib/format";

export const metadata: Metadata = {
  title: "Parcours",
  description: "Expériences professionnelles.",
};

export default async function JourneyPage() {
  const experiences = await getExperiences();

  return (
    <>
      <PageHeader
        index="03"
        label="Parcours"
        title={
          <>
            Huit ans à apprendre, <span className="text-accent">désapprendre,</span> recommencer.
          </>
        }
        lead="De l'agence à l'indépendance en passant par trois ans en interne, voici le fil (pas toujours droit) de mon parcours."
      />

      <section className="page-pad mx-auto max-w-5xl py-16">
        <ol className="relative space-y-12 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-1rem)] before:w-0.5 before:bg-line-strong">
          {experiences.map((xp) => (
            <li key={xp.id} className="relative pl-12">
              <span aria-hidden="true" className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-ink bg-accent" />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <h2 className="font-display text-3xl leading-tight">{xp.title}</h2>
                  <p className="mt-1 font-mono text-sm text-ink-soft">
                    {xp.company}
                    {xp.location ? ` — ${xp.location}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-xs text-ink-soft">{formatPeriod(xp.startDate, xp.endDate)}</p>
              </div>
              <Markdown className="mt-4 max-w-2xl space-y-3 text-sm leading-relaxed text-ink-soft">{xp.description}</Markdown>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
