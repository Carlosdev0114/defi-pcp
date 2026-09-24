"use client";

import { createContext, useContext, useState } from "react";
import { usePoll } from "@/lib/hooks/use-poll";
import { fetchUpdates } from "@/lib/notifications/client";

const ADMIN_POLL_MS = 10_000;

type Realtime = {
  /** Change à chaque événement (ou rafraîchissement complet) : clé de rechargement. */
  revision: number;
  unread: { notifications: number; messages: number } | null;
};

const RealtimeContext = createContext<Realtime>({ revision: 0, unread: null });

export const useAdminRealtime = () => useContext(RealtimeContext);

/**
 * UN seul polling par onglet admin (10 s, arrêté quand l'onglet est caché) :
 * `/api/admin/updates?since=<version>` ne touche pas PostgreSQL tant que la
 * version Redis n'a pas changé. Les écrans abonnés (cloche, messagerie…)
 * rechargent leurs données quand `revision` change.
 */
export function AdminRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [state, setState] = useState<Realtime>({ revision: 0, unread: null });

  usePoll(async (full) => {
    const result = await fetchUpdates(full ? undefined : version);
    if (!result.ok || !result.data.changed) return;
    const { version: next, unread } = result.data;
    setVersion(next);
    setState((s) => ({ revision: s.revision + 1, unread }));
  }, ADMIN_POLL_MS);

  return <RealtimeContext.Provider value={state}>{children}</RealtimeContext.Provider>;
}
