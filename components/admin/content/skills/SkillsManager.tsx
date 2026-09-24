"use client";

import { useState } from "react";
import { Btn, Field, PageTitle, Panel, inputBase } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { Pagination } from "@/components/admin/common/Pagination";
import { useRemote } from "@/lib/hooks/use-remote";
import { createItem, deleteItem, fetchPage, fieldErrors, updateItem } from "@/lib/admin/client";
import { skillCreateSchema } from "@/lib/schemas/content";
import { DeleteButton, FieldError } from "../ContentBits";

type SkillRow = { id: string; name: string; category: string; level: number; order: number };

/** Compétences : ajout (schéma partagé), niveau 1–5 modifiable en ligne, liste paginée. */
export function SkillsManager() {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [draft, setDraft] = useState({ name: "", category: "", level: "3" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { result } = useRemote(`skills:${page}:${version}`, () => fetchPage<SkillRow>("skills", page));
  const refresh = () => setVersion((n) => n + 1);
  const data = result?.ok ? result.data : null;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = skillCreateSchema.safeParse({ name: draft.name, category: draft.category, level: Number(draft.level) });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const res = await createItem("skills", parsed.data);
    if (!res.ok) return setErrors({ _: res.error });
    setErrors({});
    setDraft({ name: "", category: draft.category, level: "3" });
    refresh();
  };

  return (
    <>
      <PageTitle eyebrow="Contenu · Compétences" title="Compétences" description="Le référentiel affiché sur /competences, groupé par catégorie, niveau de 1 à 5." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Ajouter une compétence">
          <form onSubmit={add} className="space-y-4">
            <Field label="Nom"><input className={inputBase} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} maxLength={80} /><FieldError message={errors.name} /></Field>
            <Field label="Catégorie"><input className={inputBase} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} maxLength={60} placeholder="Frontend, Données…" /><FieldError message={errors.category} /></Field>
            <Field label={`Niveau — ${draft.level}/5`}><input type="range" min={1} max={5} value={draft.level} onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))} className="w-full accent-accent" /></Field>
            {errors._ ? <p className="font-mono text-xs text-accent-ink" role="alert">{errors._}</p> : null}
            <Btn type="submit" variant="accent" className="w-full">+ Ajouter</Btn>
          </form>
        </Panel>
        <Panel title={`Compétences${data ? ` — ${data.total}` : ""}`}>
          {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/competences" /> : null}
          <ul className="divide-y divide-line">
            {data?.items.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name} <span className="font-mono text-xs text-ink-faint">· {s.category}</span></p>
                  <input type="range" min={1} max={5} defaultValue={s.level} aria-label={`Niveau de ${s.name}`} className="w-full accent-accent"
                    onMouseUp={async (e) => { await updateItem("skills", s.id, { level: Number((e.target as HTMLInputElement).value) }); refresh(); }}
                    onKeyUp={async (e) => { await updateItem("skills", s.id, { level: Number((e.target as HTMLInputElement).value) }); refresh(); }} />
                </div>
                <span className="font-mono text-xs text-ink-soft">{s.level}/5</span>
                <DeleteButton label="✕" onConfirm={async () => { if ((await deleteItem("skills", s.id)).ok) refresh(); }} />
              </li>
            ))}
          </ul>
          {data ? <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} noun={["compétence", "compétences"]} /> : null}
        </Panel>
      </div>
    </>
  );
}
