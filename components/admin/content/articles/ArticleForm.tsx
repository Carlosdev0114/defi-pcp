"use client";

import { useState } from "react";
import Image from "next/image";
import { Btn, Field, inputBase } from "@/components/admin/ui";
import { articleCreateSchema } from "@/lib/schemas/content";
import { fetchPage, fieldErrors, slugify } from "@/lib/admin/client";
import { useRemote } from "@/lib/hooks/use-remote";
import { FieldError, MARKDOWN_HINT } from "../ContentBits";

export type ArticleFull = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverMediaId: string | null;
  coverMedia: { id: string; url: string; altText: string | null } | null;
  publishedAt: string | null;
};

type MediaItem = { id: string; url: string; altText: string | null };

/** Formulaire article (validé avec le schéma de l'API) ; couverture depuis la médiathèque. */
export function ArticleForm({ article, onSubmit, onCancel }: { article?: ArticleFull; onSubmit: (body: unknown) => Promise<string | null>; onCancel: () => void }) {
  const [v, setV] = useState({ title: article?.title ?? "", slug: article?.slug ?? "", excerpt: article?.excerpt ?? "", content: article?.content ?? "" });
  const [coverId, setCoverId] = useState<string | null>(article?.coverMediaId ?? null);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const library = useRemote(picking ? "article-cover-picker" : null, () => fetchPage<MediaItem>("media", 1));
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const cover = library.result?.ok ? library.result.data.items.find((m) => m.id === coverId) : article?.coverMedia?.id === coverId ? article?.coverMedia : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = articleCreateSchema.safeParse({ ...v, slug: v.slug || slugify(v.title), coverMediaId: coverId });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    const failure = await onSubmit(parsed.data);
    setSaving(false);
    if (failure) setErrors({ _: failure });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre"><input className={inputBase} value={v.title} onChange={set("title")} maxLength={160} /><FieldError message={errors.title} /></Field>
        <Field label="Slug (URL)" hint="Vide = déduit du titre"><input className={inputBase} value={v.slug} onChange={set("slug")} placeholder={slugify(v.title)} maxLength={80} /><FieldError message={errors.slug} /></Field>
      </div>
      <Field label="Extrait (aperçu des cartes)"><textarea rows={2} className={inputBase} value={v.excerpt} onChange={set("excerpt")} maxLength={400} /><FieldError message={errors.excerpt} /></Field>
      <Field label="Contenu" hint={MARKDOWN_HINT}><textarea rows={16} className={inputBase} value={v.content} onChange={set("content")} /><FieldError message={errors.content} /></Field>

      <div>
        <p className="label-mono text-ink-faint">Couverture</p>
        <div className="mt-2 flex items-center gap-3">
          {cover ? <Image src={cover.url} alt={cover.altText || v.title} width={128} height={96} sizes="128px" className="h-24 w-32 border border-line-strong object-cover" /> : <span className="text-sm text-ink-faint">Aucune</span>}
          <Btn type="button" variant="outline" className="px-3 py-1.5 text-xs" onClick={() => setPicking((p) => !p)}>{picking ? "Fermer" : "Choisir"}</Btn>
          {coverId ? <Btn type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setCoverId(null)}>Retirer</Btn> : null}
        </div>
        {picking && library.result?.ok ? (
          <ul className="mt-3 flex flex-wrap gap-3">
            {library.result.data.items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => { setCoverId(m.id); setPicking(false); }} className="w-32 border border-line-strong hover:border-accent">
                  <Image src={m.url} alt={m.altText || "Média"} width={128} height={96} sizes="128px" className="h-24 w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {errors._ ? <p className="font-mono text-xs text-accent-ink" role="alert">{errors._}</p> : null}
      <div className="flex gap-2">
        <Btn type="submit" variant="accent" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Btn>
        <Btn type="button" variant="outline" onClick={onCancel}>Annuler</Btn>
      </div>
    </form>
  );
}
