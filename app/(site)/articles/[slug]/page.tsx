import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedArticle, getPublishedArticles, getPublishedSlugs } from "@/lib/server/content";
import { Markdown } from "@/components/content/Markdown";
import { formatLongDate } from "@/lib/format";

// Générées au build pour les articles publiés ; les suivants à leur première
// visite (dynamicParams). Brouillon ou dépublié → 404.
export const dynamicParams = true;

export async function generateStaticParams() {
  const { articles } = await getPublishedSlugs();
  return articles.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const article = await getPublishedArticle((await params).slug);
  return article ? { title: article.title, description: article.excerpt } : {};
}

export default async function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();
  const others = (await getPublishedArticles(3)).filter((a) => a.slug !== slug).slice(0, 2);

  return (
    <>
      <article className="page-pad mx-auto max-w-3xl border-b-2 border-ink pb-16 pt-14">
        <Link href="/articles" className="label-mono text-accent hover:underline">
          ← Retour aux articles
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-xs text-ink-soft">
          {article.publishedAt ? <time dateTime={article.publishedAt.toISOString()}>{formatLongDate(article.publishedAt)}</time> : null}
          <span>·</span>
          <span>{article.readMinutes} min de lecture</span>
        </div>
        <h1 className="mt-6 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{article.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">{article.excerpt}</p>

        {article.coverMedia ? (
          <Image
            src={article.coverMedia.url}
            alt={article.coverMedia.altText || article.title}
            width={article.coverMedia.width ?? 1200}
            height={article.coverMedia.height ?? 700}
            sizes="(min-width: 768px) 720px, 100vw"
            className="mt-10 h-auto w-full border-2 border-ink"
            preload
          />
        ) : null}

        {/* Contenu saisi dans l'admin : Markdown → éléments React (liste blanche). */}
        <Markdown className="mt-10 space-y-6 text-[1.05rem] leading-[1.8]">{article.content}</Markdown>
      </article>

      {others.length ? (
        <section className="page-pad mx-auto max-w-3xl py-14">
          <p className="label-mono text-ink-soft">À lire aussi</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {others.map((a) => (
              <Link key={a.slug} href={`/articles/${a.slug}`} className="border-2 border-ink bg-cream p-5 transition-transform hover:-translate-y-1">
                <p className="font-display text-xl leading-snug">{a.title}</p>
                <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{a.excerpt}</p>
                <p className="mt-4 font-mono text-xs text-accent">Lire →</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
