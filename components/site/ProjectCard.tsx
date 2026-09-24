import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { yearOf } from "@/lib/format";

export type ProjectCardData = {
  slug: string;
  title: string;
  summary: string;
  techStack: string[];
  publishedAt: Date | string | null;
  cover: { url: string; altText: string | null; width: number | null; height: number | null } | null;
};

export default function ProjectCard({ project, priority = false }: { project: ProjectCardData; priority?: boolean }) {
  return (
    <Link href={`/projets/${project.slug}`} className="group block border-2 border-ink bg-cream transition-transform hover:-translate-y-1">
      <div className="relative h-52 overflow-hidden border-b-2 border-ink bg-paper">
        {project.cover ? (
          <Image
            src={project.cover.url}
            alt={project.cover.altText || `Couverture du projet ${project.title}`}
            width={project.cover.width ?? 800}
            height={project.cover.height ?? 600}
            sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
            priority={priority}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
        {project.publishedAt ? (
          <span className="absolute right-3 top-3 border border-cream bg-ink px-2 py-1 font-mono text-[0.65rem] text-cream">
            {yearOf(project.publishedAt)}
          </span>
        ) : null}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl leading-tight">{project.title}</h3>
          <ArrowUpRightIcon className="mt-1 h-4 w-4 shrink-0 text-ink-soft transition-colors group-hover:text-accent" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{project.summary}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.techStack.slice(0, 4).map((tech) => (
            <span key={tech} className="border border-line-strong px-2 py-0.5 font-mono text-[0.65rem] text-ink-soft">
              {tech}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
