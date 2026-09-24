"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Btn, PageTitle, Panel, inputBase } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { Pagination } from "@/components/admin/common/Pagination";
import { useRemote } from "@/lib/hooks/use-remote";
import { requestJson } from "@/lib/http/client";
import { deleteItem, fetchPage, updateItem } from "@/lib/admin/client";
import { DeleteButton } from "./ContentBits";

type MediaRow = { id: string; url: string; altText: string | null; width: number | null; height: number | null; sizeBytes: number; projectId: string | null };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/** Médiathèque réelle : envoi via la couche storage (validation + WebP côté serveur), alt, suppression. */
export function MediaManager() {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { result } = useRemote(`media:${page}:${version}`, () => fetchPage<MediaRow>("media", page));
  const refresh = () => setVersion((n) => n + 1);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("altText", file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "));
      const res = await requestJson("/api/admin/media", { method: "POST", body: form });
      if (!res.ok) failures.push(`${file.name} : ${res.error}`);
    }
    setUploading(false);
    setNotice(failures.length ? failures.join(" · ") : `${files.length} fichier(s) ajouté(s).`);
    if (fileRef.current) fileRef.current.value = "";
    refresh();
  };

  return (
    <>
      <PageTitle eyebrow="Contenu · Médiathèque" title="Médiathèque" description="Images servies au site : chaque fichier est vérifié puis converti en WebP côté serveur." />
      <Panel title="Ajouter des images">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft">JPEG, PNG, WebP, AVIF — 4 Mo maximum. SVG refusé.</p>
          <input ref={fileRef} id="media-upload" type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => upload(e.target.files)} />
          <label htmlFor="media-upload" className="cursor-pointer border-2 border-ink bg-ink px-4 py-2 font-mono text-sm text-cream transition-colors hover:bg-accent">
            {uploading ? "Envoi…" : "Choisir des fichiers"}
          </label>
        </div>
        {notice ? <p className="mt-3 font-mono text-xs text-accent-ink" role="status">{notice}</p> : null}
      </Panel>

      <div className="mt-6">
        {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/medias" /> : null}
        {result?.ok ? (
          <Panel title={`Fichiers — ${result.data.total}`}>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {result.data.items.map((m) => (
                <li key={m.id} className="border-2 border-ink bg-paper">
                  <div className="relative aspect-[4/3] border-b-2 border-ink bg-cream">
                    <Image src={m.url} alt={m.altText || "Média sans description"} fill sizes="(min-width: 1024px) 220px, 50vw" className="object-cover" />
                  </div>
                  <div className="space-y-2 p-3">
                    <input
                      className={inputBase}
                      defaultValue={m.altText ?? ""}
                      maxLength={200}
                      aria-label="Texte alternatif"
                      placeholder="Texte alternatif"
                      onBlur={async (e) => { if (e.target.value !== (m.altText ?? "")) await updateItem("media", m.id, { altText: e.target.value || null }); }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[0.65rem] text-ink-faint">{m.width}×{m.height} · {(m.sizeBytes / 1024).toFixed(0)} Ko{m.projectId ? " · utilisé" : ""}</span>
                      <DeleteButton onConfirm={async () => { if ((await deleteItem("media", m.id)).ok) refresh(); }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {result.data.items.length === 0 ? <p className="text-sm text-ink-faint">Aucune image.</p> : null}
            <Pagination page={result.data.page} totalPages={result.data.totalPages} total={result.data.total} onPage={setPage} noun={["fichier", "fichiers"]} />
          </Panel>
        ) : null}
      </div>
      <Btn variant="ghost" className="mt-2 text-xs" onClick={refresh}>Actualiser</Btn>
    </>
  );
}
