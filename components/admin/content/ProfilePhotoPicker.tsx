"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Btn } from "@/components/admin/ui";
import { useRemote } from "@/lib/hooks/use-remote";
import { fetchPage } from "@/lib/admin/client";

export type PhotoItem = { id: string; url: string; altText: string | null };

/** Choix de la photo du profil parmi la médiathèque ; « Retirer » → espace réservé. */
export function ProfilePhotoPicker({ value, onChange }: { value: PhotoItem | null; onChange: (photo: PhotoItem | null) => void }) {
  const [picking, setPicking] = useState(false);
  const library = useRemote(picking ? "profile-photo-picker" : null, () => fetchPage<PhotoItem>("media", 1));
  const items = library.result?.ok ? library.result.data.items : [];

  return (
    <div>
      <div className="flex items-center gap-4">
        {value ? (
          <Image src={value.url} alt={value.altText || "Photo du profil"} width={96} height={116} sizes="96px" className="h-28 w-24 border border-line-strong object-cover" />
        ) : (
          <span className="flex h-28 w-24 items-center justify-center border border-dashed border-line-strong text-center text-xs text-ink-faint">Espace réservé</span>
        )}
        <div className="flex flex-wrap gap-2">
          <Btn type="button" variant="outline" className="px-3 py-1.5 text-xs" onClick={() => setPicking((p) => !p)}>{picking ? "Fermer" : "Choisir dans la médiathèque"}</Btn>
          {value ? <Btn type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => onChange(null)}>Retirer</Btn> : null}
        </div>
      </div>
      {picking && library.result?.ok ? (
        items.length ? (
          <ul className="mt-3 flex flex-wrap gap-3">
            {items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => { onChange(m); setPicking(false); }} aria-pressed={value?.id === m.id} className="w-24 border border-line-strong hover:border-accent aria-pressed:border-accent">
                  <Image src={m.url} alt={m.altText || "Média"} width={96} height={116} sizes="96px" className="h-28 w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-faint">
            Médiathèque vide : téléversez d&apos;abord votre photo dans <Link href="/admin/medias" className="underline">Médiathèque</Link>.
          </p>
        )
      ) : null}
    </div>
  );
}
