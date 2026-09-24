"use client";

import { Btn } from "@/components/admin/ui";

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
  disabled,
  noun = ["résultat", "résultats"],
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
  disabled?: boolean;
  /** Nom des éléments comptés, au singulier et au pluriel. */
  noun?: [string, string];
}) {
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between border-t border-line pt-3">
      <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={() => onPage(page - 1)} disabled={disabled || page <= 1}>
        ← Précédent
      </Btn>
      <span className="font-mono text-xs text-ink-soft">
        Page {page} / {totalPages} · {total} {total > 1 ? noun[1] : noun[0]}
      </span>
      <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={() => onPage(page + 1)} disabled={disabled || page >= totalPages}>
        Suivant →
      </Btn>
    </nav>
  );
}
