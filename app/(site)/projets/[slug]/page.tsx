import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedProject, getPublishedSlugs } from "@/lib/server/content";
import { Markdown } from "@/components/content/Markdown";
import { SectionLabel } from "@/components/ui/buttons";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { yearOf } from "@/lib/format";

// Pages générées au build pour les projets publiés ; un projet publié ensuite
// est rendu à sa première visite puis mis en cache (dynamicParams). Brouillon
// ou dépublié → 404.
export const dynamicParams = true;

export async function generateStaticParams() {
  const { projects } = await getPublishedSlugs();
  return projects.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/projets/[slug]">): Promise<Metadata> {
  const project = await getPublishedProject((await params).slug);
  return project ? { title: project.title, description: project.summary } : {};
}

export default async function ProjectDetailPage({ params }: PageProps<"/projets/[slug]">) {
  const project = await getPublishedProject((await params).slug);
  if (!project) notFound();
  const [cover, ...gallery] = project.media;
  const links = [
    project.liveUrl ? { href: project.liveUrl, label: "Voir en ligne" } : null,
    project.repoUrl ? { href: project.repoUrl, label: "Code source" } : null,
  ].filter((l): l is { href: string; label: string } => l !== null);

  return (
    <>
      <header className="page-pad mx-auto max-w-6xl border-b-2 border-ink pb-10 pt-14">
        <Link href="/projets" className="label-mono text-accent hover:underline">
          ← Retour aux projets
        </Link>
        <div className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">{project.title}</h1>
          <div className="flex shrink-0 flex-wrap gap-3 font-mono text-xs">
            <span className="border border-line-strong bg-cream px-3 py-1.5">{yearOf(project.publishedAt)}</span>
            {project.role ? <span className="border border-line-strong bg-cream px-3 py-1.5">{project.role}</span> : null}
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{project.summary}</p>
      </header>

      {cover ? (
        <figure className="page-pad mx-auto max-w-6xl pt-12">
          <Image
            src={cover.url}
            alt={cover.altText || `Couverture du projet ${project.title}`}
            width={cover.width ?? 1200}
            height={cover.height ?? 900}
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="h-auto w-full border-2 border-ink"
            preload
          />
        </figure>
      ) : null}

      <div className="page-pad mx-auto grid max-w-6xl gap-12 py-14 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionLabel index="01">Le projet</SectionLabel>
          <Markdown className="mt-4 space-y-4 leading-relaxed text-ink">{project.description}</Markdown>
          {gallery.length ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {gallery.map((m) => (
                <Image key={m.url} src={m.url} alt={m.altText || project.title} width={m.width ?? 800} height={m.height ?? 600} sizes="(min-width: 1024px) 380px, 100vw" className="h-auto w-full border-2 border-ink" />
              ))}
            </div>
          ) : null}
        </section>

        <aside className="space-y-6 lg:pl-6">
          {project.techStack.length ? (
            <div className="border-2 border-ink bg-cream p-6">
              <p className="label-mono text-accent">Stack utilisée</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {project.techStack.map((tech) => (
                  <li key={tech} className="border border-line-strong px-2 py-1 font-mono text-xs text-ink">{tech}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {links.length ? (
            <ul className="space-y-2 font-mono text-sm">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} rel="noopener noreferrer" target="_blank" className="inline-flex items-center gap-2 text-accent hover:underline">
                    {l.label} <ArrowUpRightIcon className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="border-2 border-ink bg-ink p-6 text-cream">
            <p className="label-mono text-accent">Envie d'un projet similaire ?</p>
            <p className="mt-4 text-sm leading-relaxed text-cream/80">
              Je prends 2 ou 3 nouveaux clients par trimestre pour garder la qualité. On vérifie ensemble si on cadre bien.
            </p>
            <Link href="/reservation" className="mt-5 inline-flex items-center gap-2 border border-cream/40 px-4 py-2.5 font-mono text-sm text-cream transition-colors hover:border-accent hover:bg-accent">
              Réserver un échange <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
