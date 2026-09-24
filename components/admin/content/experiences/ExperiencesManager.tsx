"use client";

import { useState } from "react";
import { Btn, PageTitle, Panel } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { Pagination } from "@/components/admin/common/Pagination";
import { useRemote } from "@/lib/hooks/use-remote";
import { createItem, deleteItem, fetchPage, updateItem } from "@/lib/admin/client";
import { formatPeriod } from "@/lib/format";
import { DeleteButton } from "../ContentBits";
import { ExperienceForm, type ExperienceRow } from "./ExperienceForm";

/** Parcours : liste paginée côté serveur + formulaire. Publié dès l'enregistrement. */
export function ExperiencesManager() {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<ExperienceRow | "new" | null>(null);
  const { result } = useRemote(`experiences:${page}:${version}`, () => fetchPage<ExperienceRow>("experiences", page));
  const refresh = () => setVersion((n) => n + 1);
  const data = result?.ok ? result.data : null;

  const save = async (body: unknown) => {
    const res = editing === "new" ? await createItem("experiences", body) : await updateItem("experiences", (editing as ExperienceRow).id, body);
    if (!res.ok) return res.error;
    setEditing(null);
    refresh();
    return null;
  };

  return (
    <>
      <PageTitle eyebrow="Contenu · Parcours" title="Expériences" description="Le fil affiché sur /parcours (publié dès l'enregistrement)." actions={<Btn variant="accent" onClick={() => setEditing("new")}>+ Nouvelle expérience</Btn>} />
      {editing ? (
        <Panel title={editing === "new" ? "Nouvelle expérience" : `Modifier — ${editing.title}`}>
          <ExperienceForm key={editing === "new" ? "new" : editing.id} experience={editing === "new" ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} />
        </Panel>
      ) : (
        <>
          {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/parcours" /> : null}
          {data ? (
            <div className="space-y-3">
              {data.items.map((xp) => (
                <div key={xp.id} className="flex flex-col justify-between gap-3 border-2 border-ink bg-cream p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-display text-xl">{xp.title}</p>
                    <p className="font-mono text-xs text-ink-soft">{xp.company} · {formatPeriod(xp.startDate, xp.endDate)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(xp)}>Éditer</Btn>
                    <DeleteButton onConfirm={async () => { if ((await deleteItem("experiences", xp.id)).ok) refresh(); }} />
                  </div>
                </div>
              ))}
              {data.items.length === 0 ? <p className="text-sm text-ink-faint">Aucune expérience.</p> : null}
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} noun={["expérience", "expériences"]} />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
