import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import ProjectCard from "@/components/site/ProjectCard";
import { getPublishedProjects } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Projets",
  description: "Projets livrés, en cours et side-projects.",
};

export default async function ProjectsPage() {
  const projects = await getPublishedProjects();

  return (
    <>
      <PageHeader
        index="04"
        label="Projets"
        title={
          <>
            La vitrine, <span className="text-accent">pas l'entrepôt.</span>
          </>
        }
        lead="Quelques projets significatifs, racontés de façon honnête : le contexte, le problème, ce qui a été fait et ce que ça a changé."
      />

      <section className="page-pad mx-auto grid max-w-6xl gap-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p, i) => (
          <ProjectCard key={p.slug} project={p} priority={i === 0} />
        ))}

        <a
          href="/contact"
          className="group flex min-h-52 flex-col justify-between border-2 border-ink bg-accent p-6 text-cream transition-transform hover:-translate-y-1"
        >
          <p className="font-display text-3xl leading-tight">Votre projet pourrait être le prochain.</p>
          <p className="font-mono text-sm group-hover:underline">Parler de votre idée →</p>
        </a>
      </section>
    </>
  );
}
