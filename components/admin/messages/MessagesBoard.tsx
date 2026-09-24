"use client";

import { useState } from "react";
import { PageTitle } from "@/components/admin/ui";
import { Pagination } from "@/components/admin/common/Pagination";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { useRemote } from "@/lib/hooks/use-remote";
import { fetchConversations, markConversationRead, type AdminConversation } from "@/lib/messaging/admin-client";
import { useAdminRealtime } from "@/components/admin/realtime/AdminRealtimeProvider";
import { ConversationList } from "./ConversationList";
import { AdminThread } from "./AdminThread";

/** Messagerie admin : conversations paginées + fil, rechargés à chaque
 * événement temps réel (polling partagé du layout, 10 s). */
export function MessagesBoard() {
  const { revision, unread } = useAdminRealtime();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminConversation | null>(null);
  const [local, setLocal] = useState(0);
  const { result } = useRemote(`convs:${page}:${revision}:${local}`, () => fetchConversations(page));
  const data = result?.ok ? result.data : null;
  const current = selected ? data?.items.find((c) => c.id === selected.id) ?? selected : null;

  const open = async (c: AdminConversation) => {
    setSelected(c);
    if (c.unread > 0 && (await markConversationRead(c.id)).ok) setLocal((n) => n + 1);
  };

  return (
    <>
      <PageTitle
        eyebrow="Client · Messages"
        title="Messages reçus"
        description={`${unread?.messages ?? "…"} message(s) non lu(s). Les nouveaux messages apparaissent sans recharger la page (sous 10 s).`}
      />
      <div className="flex h-[70vh] overflow-hidden border-2 border-ink bg-cream">
        <div className="flex w-2/5 flex-col border-r-2 border-line">
          <div className="flex-1 overflow-y-auto">
            {result && !result.ok ? <div className="p-3"><ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/messages" /></div> : null}
            {data ? <ConversationList items={data.items} selectedId={current?.id ?? null} onSelect={open} /> : null}
          </div>
          {data && data.totalPages > 1 ? (
            <div className="px-3 pb-2">
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} noun={["conversation", "conversations"]} />
            </div>
          ) : null}
        </div>
        {current ? (
          <AdminThread conversation={current} revision={revision + local} onReplied={() => setLocal((n) => n + 1)} />
        ) : (
          <p className="m-auto text-sm text-ink-faint">Sélectionnez une conversation.</p>
        )}
      </div>
    </>
  );
}
