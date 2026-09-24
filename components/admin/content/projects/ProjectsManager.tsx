"use client";

import { useState } from "react";
import { Btn, PageTitle, Panel } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { Pagination } from "@/components/admin/common/Pagination";
import { useRemote } from "@/lib/hooks/use-remote";
import { createItem, deleteItem, fetchPage, setPublished, updateItem, type PublishFilter } from "@/lib/admin/client";
import { DeleteButton, PublishFilterTabs, StatusTag } from "../ContentBits";
import { ProjectForm, type ProjectRow } from "./ProjectForm";
import { ProjectMedia } from "./ProjectMedia";

/** Projets : liste paginée côté serveur, brouillon/publié, formulaire, visuels. */
export function ProjectsManager() {
  const [status, setStatus] = useState<PublishFilter>("all");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<ProjectRow | "new" | null>(null);
  const { result } = useRemote(`projects:${status}:${page}:${version}`, () => fetchPage<ProjectRow>("projects", page, status));
  const refresh = () => setVersion((n) => n + 1);
  const data = result?.ok ? result.data : null;
  const current = editing && editing !== "new" ? data?.items.find((p) => p.id === editing.id) ?? editing : editing;

  const save = async (body: unknown) => {
    const res = current === "new" ? await createItem("projects", body) : await updateItem("projects", (current as ProjectRow).id, body);
    if (!res.ok) return res.error;
    setEditing(null);
    refresh();
    return null;
  };

  return (
    <>
      <PageTitle eyebrow="Contenu · Projets" title="Projets" description="Les projets publiés apparaissent sur /projets ; un brouillon reste invisible (404)." actions={<Btn variant="accent" onClick={() => setEditing("new")}>+ Nouveau projet</Btn>} />

      {current ? (
        <Panel title={current === "new" ? "Nouveau projet" : `Modifier — ${current.title}`}>
          <ProjectForm key={current === "new" ? "new" : current.id} project={current === "new" ? undefined : current} onSubmit={save} onCancel={() => setEditing(null)} />
          {current !== "new" ? <ProjectMedia project={current} onChanged={refresh} /> : null}
        </Panel>
      ) : (
        <>
          <PublishFilterTabs value={status} onChange={(s) => { setStatus(s); setPage(1); }} />
          {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/projets" /> : null}
          {data ? (
            <div className="border-2 border-ink bg-cream">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-ink bg-paper font-mono text-xs text-ink-soft">
                    <th className="px-4 py-2.5">Projet</th><th className="px-4 py-2.5">Statut</th><th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((p) => (
                    <tr key={p.id} className="hover:bg-paper">
                      <td className="px-4 py-3"><p className="font-medium">{p.title}</p><p className="font-mono text-xs text-ink-faint">/projets/{p.slug} · {p.media.length} visuel(s)</p></td>
                      <td className="px-4 py-3"><StatusTag publishedAt={p.publishedAt} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Btn variant="outline" className="px-2 py-1 text-xs" onClick={async () => { if ((await setPublished("projects", p.id, !p.publishedAt)).ok) refresh(); }}>
                            {p.publishedAt ? "Dépublier" : "Publier"}
                          </Btn>
                          <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(p)}>Éditer</Btn>
                          <DeleteButton onConfirm={async () => { if ((await deleteItem("projects", p.id)).ok) refresh(); }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.items.length === 0 ? <p className="p-4 text-sm text-ink-faint">Aucun projet.</p> : null}
              <div className="px-4 pb-3"><Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} noun={["projet", "projets"]} /></div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
