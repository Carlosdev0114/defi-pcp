"use client";

import { useState } from "react";
import { Btn, Tag } from "@/components/admin/ui";
import type { PublishFilter } from "@/lib/admin/client";
import { cn } from "@/lib/utils";

/** Pastille de statut éditorial. */
export function StatusTag({ publishedAt }: { publishedAt: string | null }) {
  if (!publishedAt) return <Tag>Brouillon</Tag>;
  return new Date(publishedAt) > new Date() ? <Tag tone="warn">Programmé</Tag> : <Tag tone="ok">Publié</Tag>;
}

/** Filtre Tous / Publiés / Brouillons. */
export function PublishFilterTabs({ value, onChange }: { value: PublishFilter; onChange: (v: PublishFilter) => void }) {
  const tabs: [PublishFilter, string][] = [
    ["all", "Tous"],
    ["published", "Publiés"],
    ["draft", "Brouillons"],
  ];
  return (
    <div role="tablist" aria-label="Statut" className="mb-4 flex gap-2">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn("border-2 px-3 py-1.5 font-mono text-xs", value === key ? "border-ink bg-ink text-cream" : "border-line-strong bg-cream hover:border-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Suppression en deux clics (confirmation explicite). */
export function DeleteButton({ onConfirm, label = "Suppr." }: { onConfirm: () => Promise<void> | void; label?: string }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <span className="flex gap-1">
      <Btn variant="danger" className="px-2 py-1 text-xs" onClick={async () => { await onConfirm(); setArmed(false); }}>
        Confirmer
      </Btn>
      <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => setArmed(false)}>
        Annuler
      </Btn>
    </span>
  ) : (
    <Btn variant="danger" className="px-2 py-1 text-xs" onClick={() => setArmed(true)}>
      {label}
    </Btn>
  );
}

/** Message d'erreur sous un champ. */
export function FieldError({ message }: { message?: string }) {
  return message ? <span className="mt-1 block font-mono text-xs text-accent-ink">{message}</span> : null;
}

/** Aide Markdown affichée sous les zones de texte riche. */
export const MARKDOWN_HINT = "Markdown : ## titre, **gras**, *italique*, listes « - », liens [texte](https://…). Pas d'images ni de HTML.";
