"use client";

import { useState } from "react";
import { Btn, Field, inputBase } from "@/components/admin/ui";
import { projectCreateSchema } from "@/lib/schemas/content";
import { fieldErrors, slugify } from "@/lib/admin/client";
import { FieldError, MARKDOWN_HINT } from "../ContentBits";

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  techStack: string[];
  role: string | null;
  liveUrl: string | null;
  repoUrl: string | null;
  featured: boolean;
  order: number;
  publishedAt: string | null;
  media: { id: string; url: string; altText: string | null; width: number | null; height: number | null }[];
};

type Values = { title: string; slug: string; summary: string; description: string; techStack: string; role: string; liveUrl: string; repoUrl: string; featured: boolean; order: string };

const toValues = (p?: ProjectRow): Values => ({
  title: p?.title ?? "",
  slug: p?.slug ?? "",
  summary: p?.summary ?? "",
  description: p?.description ?? "",
  techStack: p?.techStack.join(", ") ?? "",
  role: p?.role ?? "",
  liveUrl: p?.liveUrl ?? "",
  repoUrl: p?.repoUrl ?? "",
  featured: p?.featured ?? false,
  order: String(p?.order ?? 0),
});

/** Formulaire projet (création / modification), validé avec le schéma de l'API. */
export function ProjectForm({ project, onSubmit, onCancel }: { project?: ProjectRow; onSubmit: (body: unknown) => Promise<string | null>; onCancel: () => void }) {
  const [v, setV] = useState<Values>(() => toValues(project));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((x) => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      title: v.title,
      slug: v.slug || slugify(v.title),
      summary: v.summary,
      description: v.description,
      techStack: v.techStack.split(",").map((s) => s.trim()).filter(Boolean),
      role: v.role.trim() || null,
      liveUrl: v.liveUrl.trim() || null,
      repoUrl: v.repoUrl.trim() || null,
      featured: v.featured,
      order: Number(v.order) || 0,
    };
    const parsed = projectCreateSchema.safeParse(body);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    const failure = await onSubmit(parsed.data);
    setSaving(false);
    if (failure) setErrors({ _: failure });
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Titre"><input className={inputBase} value={v.title} onChange={set("title")} maxLength={120} /><FieldError message={errors.title} /></Field>
      <Field label="Slug (URL)" hint="Vide = déduit du titre"><input className={inputBase} value={v.slug} onChange={set("slug")} placeholder={slugify(v.title)} maxLength={80} /><FieldError message={errors.slug} /></Field>
      <Field label="Résumé" className="sm:col-span-2"><input className={inputBase} value={v.summary} onChange={set("summary")} maxLength={300} /><FieldError message={errors.summary} /></Field>
      <Field label="Description" hint={MARKDOWN_HINT} className="sm:col-span-2"><textarea rows={12} className={inputBase} value={v.description} onChange={set("description")} /><FieldError message={errors.description} /></Field>
      <Field label="Stack" hint="Séparée par des virgules"><input className={inputBase} value={v.techStack} onChange={set("techStack")} /><FieldError message={errors.techStack} /></Field>
      <Field label="Rôle"><input className={inputBase} value={v.role} onChange={set("role")} maxLength={120} /></Field>
      <Field label="Lien en ligne (https)"><input className={inputBase} value={v.liveUrl} onChange={set("liveUrl")} /><FieldError message={errors.liveUrl} /></Field>
      <Field label="Code source (https)"><input className={inputBase} value={v.repoUrl} onChange={set("repoUrl")} /><FieldError message={errors.repoUrl} /></Field>
      <Field label="Ordre"><input type="number" min={0} className={inputBase} value={v.order} onChange={set("order")} /></Field>
      <label className="flex items-center gap-2 self-end pb-2 font-mono text-sm"><input type="checkbox" checked={v.featured} onChange={set("featured")} className="h-4 w-4 accent-accent" /> Mis en avant</label>
      {errors._ ? <p className="sm:col-span-2 font-mono text-xs text-accent-ink" role="alert">{errors._}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Btn type="submit" variant="accent" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Btn>
        <Btn type="button" variant="outline" onClick={onCancel}>Annuler</Btn>
      </div>
    </form>
  );
}
