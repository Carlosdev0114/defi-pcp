import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { PortraitPlaceholder } from "@/components/site/PortraitPlaceholder";
import { getProfile } from "@/lib/server/site-config";
import { getExperiences, getPublishedSlugs } from "@/lib/server/content";
import { SectionLabel } from "@/components/ui/buttons";

export const metadata: Metadata = {
  title: "À propos",
  description: "Profil, bio et philosophie de travail.",
};

/** Chiffres calculés depuis la base (rien d'inventé). */
async function loadHighlights() {
  const [experiences, slugs] = await Promise.all([getExperiences(), getPublishedSlugs()]);
  const first = experiences.reduce<Date | null>((min, x) => (!min || x.startDate < min ? x.startDate : min), null);
  const years = first ? Math.max(1, Math.floor((Date.now() - first.getTime()) / (365.25 * 86_400_000))) : 0;
  return [
    ...(years ? [{ value: `${years} ans`, label: "d'expérience" }] : []),
    { value: String(experiences.length), label: "postes occupés" },
    { value: String(slugs.projects.length), label: "projets présentés" },
    { value: String(slugs.articles.length), label: "articles publiés" },
  ];
}

export default async function AboutPage() {
  const [profile, highlighs] = await Promise.all([getProfile(), loadHighlights()]);
  const contact = [profile.email, profile.phone, profile.location].filter(Boolean);
  return (
    <>
      <PageHeader
        index="01"
        label="Profil"
        title={
          <>
            Du cahier des charges{" "}
            <span className="text-accent">au cahier des recettes.</span>
          </>
        }
        lead="Huit ans que je fais du frontend, dont la moitié à mon compte, avec une obsession : que les choses finissent en production et que quelqu'un raconte comment ça s'est passé."
      />

      <div className="page-pad mx-auto grid max-w-6xl gap-12 py-16 md:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <figure className="relative max-w-sm">
            <PortraitPlaceholder name={profile.name} className="border-2 border-ink" />
          </figure>
          <ul className="grid grid-cols-2 gap-4">
            {highlighs.map((h) => (
              <li key={h.label} className="border border-line-strong bg-cream p-4">
                <p className="font-display text-3xl text-accent">{h.value}</p>
                <p className="mt-1 text-sm text-ink-soft">{h.label}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-8 text-base leading-relaxed text-ink">
          <SectionLabel>La longue version</SectionLabel>
          {profile.shortBio ? <p>{profile.shortBio}</p> : null}
          <p>
            J'ai commencé en agence, où j'ai appris à défendre un délai et à
            négocier un périmètre avant de coder la première ligne. Puis je suis
            passée côté produit pendant trois ans, à tenir une application en
            production pour des rédactions — un excellent apprentissage de
            l'humilité quand votre « petit truc à corriger » casse le site
            d'un journal national un soir d'élection.
          </p>
          <p>
            Depuis 2021, je travaille seule ou en petite équipe sur des sujets
            concrets : un simulateur pour une métropole, un back-office pour un
            négociant en vin, une boutique pour une mercerie. J'aime les projets
            où le métier est clair et où la technique peut rester simple.
          </p>
          <p>
            Côté méthode, je suis une grande croyante des écrans d'abord, des
            données ensuite, et des tests là où ça fait mal. Je fais des
            retours francs, je rends des avis documentés, et je considère qu'une
            question bête posée à temps vaut mieux qu'une architecture géniale
            à contretemps.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-2 border-ink bg-ink p-5 text-cream">
              <p className="label-mono text-accent">Coordonnées</p>
              <ul className="mt-3 space-y-1.5 font-mono text-sm">
                {contact.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="border-2 border-ink bg-cream p-5">
              <p className="label-mono text-accent">Détails utiles</p>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                <li>Facturation : taux journalier</li>
                <li>Réponse sous 24 h ouvrées</li>
                <li>Télétravail + déplacements ponctuels</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}