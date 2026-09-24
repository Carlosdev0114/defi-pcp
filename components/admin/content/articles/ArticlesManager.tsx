"use client";

import { useState } from "react";
import { Btn, PageTitle, Panel } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { Pagination } from "@/components/admin/common/Pagination";
import { useRemote } from "@/lib/hooks/use-remote";
import { createItem, deleteItem, fetchOne, fetchPage, setPublished, updateItem, type PublishFilter } from "@/lib/admin/client";
import { formatLongDate } from "@/lib/format";
import { DeleteButton, PublishFilterTabs, StatusTag } from "../ContentBits";
import { ArticleForm, type ArticleFull } from "./ArticleForm";

type ArticleRow = { id: string; slug: string; title: string; publishedAt: string | null; updatedAt: string };

/** Articles : liste paginée, brouillon/publié ; l'édition charge le contenu complet. */
export function ArticlesManager() {
  const [status, setStatus] = useState<PublishFilter>("all");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { result } = useRemote(`articles:${status}:${page}:${version}`, () => fetchPage<ArticleRow>("articles", page, status));
  const full = useRemote(editing && editing !== "new" ? `article:${editing}` : null, () => fetchOne<ArticleFull>("articles", editing!));
  const refresh = () => setVersion((n) => n + 1);
  const data = result?.ok ? result.data : null;

  const save = async (body: unknown) => {
    const res = editing === "new" ? await createItem("articles", body) : await updateItem("articles", editing!, body);
    if (!res.ok) return res.error;
    setEditing(null);
    refresh();
    return null;
  };

  if (editing) {
    const article = editing === "new" ? undefined : full.result?.ok ? full.result.data : null;
    return (
      <>
        <PageTitle eyebrow="Contenu · Articles" title={editing === "new" ? "Nouvel article" : "Modifier l'article"} />
        <Panel title={article?.title ?? "Nouvel article"}>
          {article === null ? <p className="font-mono text-xs text-ink-faint">Chargement…</p> : <ArticleForm key={editing} article={article} onSubmit={save} onCancel={() => setEditing(null)} />}
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageTitle eyebrow="Contenu · Articles" title="Articles" description="Contenu en Markdown, rendu sans HTML brut. Un brouillon reste invisible (404)." actions={<Btn variant="accent" onClick={() => setEditing("new")}>+ Nouvel article</Btn>} />
      <PublishFilterTabs value={status} onChange={(s) => { setStatus(s); setPage(1); }} />
      {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/articles" /> : null}
      {data ? (
        <div className="border-2 border-ink bg-cream">
          <ul className="divide-y divide-line">
            {data.items.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="font-mono text-xs text-ink-faint">/articles/{a.slug} · modifié le {formatLongDate(a.updatedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusTag publishedAt={a.publishedAt} />
                  <Btn variant="outline" className="px-2 py-1 text-xs" onClick={async () => { if ((await setPublished("articles", a.id, !a.publishedAt)).ok) refresh(); }}>
                    {a.publishedAt ? "Dépublier" : "Publier"}
                  </Btn>
                  <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(a.id)}>Éditer</Btn>
                  <DeleteButton onConfirm={async () => { if ((await deleteItem("articles", a.id)).ok) refresh(); }} />
                </div>
              </li>
            ))}
          </ul>
          {data.items.length === 0 ? <p className="p-4 text-sm text-ink-faint">Aucun article.</p> : null}
          <div className="px-4 pb-3"><Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} noun={["article", "articles"]} /></div>
        </div>
      ) : null}
    </>
  );
}
