"use client";

import { useState } from "react";
import Image from "next/image";
import { Btn } from "@/components/admin/ui";
import { useRemote } from "@/lib/hooks/use-remote";
import { fetchPage, updateItem } from "@/lib/admin/client";
import type { ProjectRow } from "./ProjectForm";

type MediaItem = { id: string; url: string; altText: string | null; width: number | null; height: number | null; projectId: string | null };

/** Visuels d'un projet : le premier est la couverture. Ajout depuis la médiathèque. */
export function ProjectMedia({ project, onChanged }: { project: ProjectRow; onChanged: () => void }) {
  const [picking, setPicking] = useState(false);
  const library = useRemote(picking ? "media-picker" : null, () => fetchPage<MediaItem>("media", 1));
  const free = library.result?.ok ? library.result.data.items.filter((m) => !m.projectId) : [];

  const attach = async (mediaId: string, projectId: string | null) => {
    if ((await updateItem("media", mediaId, { projectId })).ok) onChanged();
  };

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="label-mono text-ink-faint">Visuels (le premier sert de couverture)</p>
      <ul className="mt-2 flex flex-wrap gap-3">
        {project.media.map((m) => (
          <li key={m.id} className="w-32 border border-line-strong">
            <Image src={m.url} alt={m.altText || project.title} width={128} height={96} sizes="128px" className="h-24 w-full object-cover" />
            <Btn variant="ghost" className="w-full px-1 py-1 text-xs" onClick={() => attach(m.id, null)}>Retirer</Btn>
          </li>
        ))}
        {project.media.length === 0 ? <li className="text-sm text-ink-faint">Aucun visuel.</li> : null}
      </ul>
      <Btn variant="outline" className="mt-3 px-3 py-1.5 text-xs" onClick={() => setPicking((p) => !p)}>
        {picking ? "Fermer la médiathèque" : "+ Ajouter depuis la médiathèque"}
      </Btn>
      {picking ? (
        <ul className="mt-3 flex flex-wrap gap-3">
          {free.map((m) => (
            <li key={m.id}>
              <button onClick={() => attach(m.id, project.id)} className="w-32 border border-line-strong hover:border-accent" title="Ajouter à ce projet">
                <Image src={m.url} alt={m.altText || "Média"} width={128} height={96} sizes="128px" className="h-24 w-full object-cover" />
              </button>
            </li>
          ))}
          {library.result?.ok && free.length === 0 ? <li className="text-sm text-ink-faint">Aucun média libre : ajoutez-en dans la médiathèque.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
