"use client";

import { useState } from "react";
import { Btn, Field, inputBase } from "@/components/admin/ui";
import { experienceCreateSchema } from "@/lib/schemas/content";
import { fieldErrors } from "@/lib/admin/client";
import { FieldError, MARKDOWN_HINT } from "../ContentBits";

export type ExperienceRow = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string;
  order: number;
};

const toMonth = (iso: string | null) => (iso ? iso.slice(0, 7) : "");
const fromMonth = (m: string) => (m ? `${m}-01T00:00:00.000Z` : null);

export function ExperienceForm({ experience, onSubmit, onCancel }: { experience?: ExperienceRow; onSubmit: (body: unknown) => Promise<string | null>; onCancel: () => void }) {
  const [v, setV] = useState({
    title: experience?.title ?? "",
    company: experience?.company ?? "",
    location: experience?.location ?? "",
    start: toMonth(experience?.startDate ?? null),
    end: toMonth(experience?.endDate ?? null),
    description: experience?.description ?? "",
    order: String(experience?.order ?? 0),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = experienceCreateSchema.safeParse({
      title: v.title,
      company: v.company,
      location: v.location.trim() || null,
      startDate: fromMonth(v.start) ?? "",
      endDate: fromMonth(v.end),
      description: v.description,
      order: Number(v.order) || 0,
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    const failure = await onSubmit(parsed.data);
    setSaving(false);
    if (failure) setErrors({ _: failure });
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Poste"><input className={inputBase} value={v.title} onChange={set("title")} maxLength={120} /><FieldError message={errors.title} /></Field>
      <Field label="Entreprise"><input className={inputBase} value={v.company} onChange={set("company")} maxLength={120} /><FieldError message={errors.company} /></Field>
      <Field label="Début"><input type="month" className={inputBase} value={v.start} onChange={set("start")} /><FieldError message={errors.startDate} /></Field>
      <Field label="Fin (vide = en cours)"><input type="month" className={inputBase} value={v.end} onChange={set("end")} /><FieldError message={errors.endDate} /></Field>
      <Field label="Lieu"><input className={inputBase} value={v.location} onChange={set("location")} maxLength={120} /></Field>
      <Field label="Ordre"><input type="number" min={0} className={inputBase} value={v.order} onChange={set("order")} /></Field>
      <Field label="Description" hint={MARKDOWN_HINT} className="sm:col-span-2"><textarea rows={8} className={inputBase} value={v.description} onChange={set("description")} /><FieldError message={errors.description} /></Field>
      {errors._ ? <p className="font-mono text-xs text-accent-ink sm:col-span-2" role="alert">{errors._}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Btn type="submit" variant="accent" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Btn>
        <Btn type="button" variant="outline" onClick={onCancel}>Annuler</Btn>
      </div>
    </form>
  );
}
