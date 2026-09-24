import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import ArticleCard from "@/components/site/ArticleCard";
import { getPublishedArticles } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Articles",
  description: "Le blog : méthode, code, métier et design.",
};

export default async function ArticlesPage() {
  const articles = await getPublishedArticles();

  return (
    <>
      <PageHeader
        index="05"
        label="Articles"
        title={
          <>
            À lire quand vous avez <span className="text-accent">cinq minutes.</span>
          </>
        }
        lead="Des notes écrites pour moi-même avant tout — mais si elles vous font gagner une heure d'essais-erreurs, tant mieux."
      />

      <section className="page-pad mx-auto grid max-w-6xl gap-6 py-16 md:grid-cols-2">
        {articles.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
        <div className="flex flex-col justify-end border-2 border-dashed border-line-strong p-6">
          <p className="font-display text-2xl">Un sujet sur le métier à creuser ?</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            J'accepte les demandes de sujet un article par mois. Le plus souvent traité en un weekend, sans promesse de hauteur de vue.
          </p>
        </div>
      </section>
    </>
  );
}
