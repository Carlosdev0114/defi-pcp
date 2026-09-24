"use client";

import { useState } from "react";
import { Btn, Panel } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { Pagination } from "@/components/admin/common/Pagination";
import { useRemote } from "@/lib/hooks/use-remote";
import { deleteBlock, fetchBlocks } from "@/lib/booking/client";
import { formatParis } from "@/lib/time/paris";
import { BlockSlotForm } from "./BlockSlotForm";

/** Blocages à venir (paginés) + formulaire de blocage. */
export function BlocksPanel({ onChanged }: { onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const { result, loading } = useRemote(`blocks:${page}:${version}`, () => fetchBlocks(page));

  const refresh = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  const remove = async (id: string) => {
    const res = await deleteBlock(id);
    if (res.ok) refresh();
  };

  return (
    <Panel title="Créneaux bloqués">
      <BlockSlotForm onCreated={refresh} />
      <div className="mt-5 border-t border-line pt-4">
        {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/agenda" /> : null}
        {loading && !result ? <p className="font-mono text-xs text-ink-faint" role="status">Chargement…</p> : null}
        {result?.ok ? (
          <>
            {result.data.items.length === 0 ? <p className="text-sm text-ink-faint">Aucun blocage à venir.</p> : null}
            <ul className="divide-y divide-line">
              {result.data.items.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate">{b.title}</span>
                    <span className="block font-mono text-[0.65rem] text-ink-faint">
                      {formatParis(b.startAt)} → {formatParis(b.endAt, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <Btn variant="danger" className="px-2 py-1 text-xs" onClick={() => remove(b.id)}>
                    Retirer
                  </Btn>
                </li>
              ))}
            </ul>
            {result.data.totalPages > 1 ? (
              <Pagination page={result.data.page} totalPages={result.data.totalPages} total={result.data.total} onPage={setPage} noun={["blocage", "blocages"]} />
            ) : null}
          </>
        ) : null}
      </div>
    </Panel>
  );
}
