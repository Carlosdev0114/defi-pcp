import Link from "next/link";
import { formatLongDate } from "@/lib/format";

export type ArticleCardData = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | string | null;
  readMinutes: number;
};

export default function ArticleCard({ article }: { article: ArticleCardData }) {
  return (
    <Link href={`/articles/${article.slug}`} className="group flex flex-col border-2 border-ink bg-cream p-6 transition-transform hover:-translate-y-1">
      <div className="flex items-center justify-end font-mono text-xs text-ink-soft">
        <span>{article.readMinutes} min de lecture</span>
      </div>
      <h3 className="mt-5 font-display text-2xl leading-tight transition-colors group-hover:text-accent">{article.title}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">{article.excerpt}</p>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4 font-mono text-xs text-ink-soft">
        {article.publishedAt ? <time dateTime={new Date(article.publishedAt).toISOString()}>{formatLongDate(article.publishedAt)}</time> : <span />}
        <span className="text-accent">Lire →</span>
      </div>
    </Link>
  );
}
