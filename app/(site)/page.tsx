import Hero from "@/components/site/hero/Hero";
import ProjectCard from "@/components/site/ProjectCard";
import ArticleCard from "@/components/site/ArticleCard";
import { SectionLabel } from "@/components/ui/buttons";
import { ArrowRightIcon } from "@/components/ui/icons";
import { getPublishedArticles, getPublishedProjects } from "@/lib/server/content";
import { getProfile } from "@/lib/server/site-config";
import { getActiveServices } from "@/lib/server/appointments";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

/** Services réels, lus au build (page statique) puis rafraîchis par
 * revalidatePath("/") à chaque modification d'un service dans l'admin. */
async function loadServices() {
  try {
    return await getActiveServices();
  } catch (error) {
    unstable_rethrow(error); // signaux internes de Next : pas une panne
    console.error("Accueil : services indisponibles", error);
    return [];
  }
}

/** Accueil statique : contenu PUBLIÉ lu en base au build, puis régénéré
 * (revalidatePath) à chaque publication ou modification dans l'admin. */
export default async function Home() {
  const [featured, latest, services, profile] = await Promise.all([
    getPublishedProjects(3),
    getPublishedArticles(2),
    loadServices(),
    getProfile(),
  ]);

  return (
    <>
      <Hero profile={profile} />

      <section className="page-pad mx-auto max-w-6xl py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <SectionLabel index="01">Sélection de projets</SectionLabel>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl">
              Des choses réelles, livrées.
            </h2>
          </div>
          <Link
            href="/projets"
            className="mb-2 hidden items-center gap-2 font-mono text-sm text-accent hover:underline sm:flex"
          >
            Tout voir <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {featured.map((p, i) => (
            <ProjectCard key={p.slug} project={p} priority={i === 0} />
          ))}
        </div>
        <Link href="/projets" className="mt-6 flex items-center gap-2 font-mono text-sm text-accent sm:hidden">
          Tout voir <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </section>

      <section className="border-y-2 border-ink bg-ink text-cream">
        <div className="page-pad mx-auto grid max-w-6xl gap-10 py-16 md:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionLabel className="text-cream/50" index="02">
              Pourquoi j'existe en indépendante
            </SectionLabel>
            <p className="mt-5 text-lg leading-relaxed text-cream/90">
              Parce que la qualité d'un projet, c'est souvent une question de
              contexte : qui comprend le métier, qui va décider vite, qui écoute
              les contraintes. Je mets mes compétences techniques au service de
              ça.
            </p>
          </div>
          <ul className="grid content-center gap-4">
            {services.slice(0, 2).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between border border-cream/20 px-4 py-3"
              >
                <div>
                  <p className="font-display text-lg">{s.name}</p>
                  <p className="font-mono text-xs text-cream/60">{s.durationMin} min</p>
                </div>
                <Link
                  href="/reservation"
                  className="border border-cream/40 px-3 py-1.5 font-mono text-xs text-cream transition-colors hover:bg-accent hover:border-accent"
                >
                  Réserver
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page-pad mx-auto max-w-6xl py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <SectionLabel index="03">Le blog</SectionLabel>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl">
              Quelques notes, sans prétention.
            </h2>
          </div>
          <Link
            href="/articles"
            className="mb-2 hidden items-center gap-2 font-mono text-sm text-accent hover:underline sm:flex"
          >
            Tous les articles <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {latest.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      </section>
    </>
  );
}