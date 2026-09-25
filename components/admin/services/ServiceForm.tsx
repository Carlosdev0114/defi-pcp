"use client";

import { useState } from "react";
import { Btn, Field, inputBase } from "@/components/admin/ui";
import { FieldError } from "@/components/admin/content/ContentBits";
import { fieldErrors } from "@/lib/admin/client";
import type { ServiceRow } from "@/lib/admin/services";
import { serviceCreateSchema } from "@/lib/schemas/services";

/** Nom, durée, description et activation d'un service (validation partagée avec l'API). */
export function ServiceForm({ service, onSubmit, onCancel }: { service?: ServiceRow; onSubmit: (body: unknown) => Promise<string | null>; onCancel: () => void }) {
  const [v, setV] = useState({
    name: service?.name ?? "",
    durationMin: String(service?.durationMin ?? 30),
    description: service?.description ?? "",
    active: service?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: "name" | "durationMin" | "description") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = serviceCreateSchema.safeParse({
      name: v.name,
      durationMin: Number(v.durationMin),
      description: v.description.trim() || null,
      active: v.active,
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
      <Field label="Nom"><input className={inputBase} value={v.name} onChange={set("name")} maxLength={120} /><FieldError message={errors.name} /></Field>
      <Field label="Durée (minutes, 15 à 480)"><input type="number" min={15} max={480} step={15} className={inputBase} value={v.durationMin} onChange={set("durationMin")} /><FieldError message={errors.durationMin} /></Field>
      <Field label="Description (texte simple, tarif compris)" className="sm:col-span-2"><textarea rows={4} className={inputBase} value={v.description} onChange={set("description")} maxLength={2000} /><FieldError message={errors.description} /></Field>
      <label className="flex items-center gap-2 font-mono text-sm sm:col-span-2">
        <input type="checkbox" checked={v.active} onChange={(e) => setV((x) => ({ ...x, active: e.target.checked }))} className="h-4 w-4 accent-accent" /> Réservable par les visiteurs
      </label>
      {errors._ ? <p className="font-mono text-xs text-accent-ink sm:col-span-2" role="alert">{errors._}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Btn type="submit" variant="accent" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Btn>
        <Btn type="button" variant="outline" onClick={onCancel}>Annuler</Btn>
      </div>
    </form>
  );
}
