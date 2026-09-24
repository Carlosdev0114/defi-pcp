"use client";

import { useState } from "react";
import Link from "next/link";
import { BellIcon } from "@/components/ui/icons";
import { useRemote } from "@/lib/hooks/use-remote";
import { fetchNotifications, markNotificationsRead, notificationHref, notificationKind, notificationText } from "@/lib/notifications/client";
import { formatParis } from "@/lib/time/paris";
import { cn } from "@/lib/utils";
import { useAdminRealtime } from "./AdminRealtimeProvider";

/** Cloche : compteur de non-lues réel, liste paginée côté serveur (10 par page). */
export function NotificationBell() {
  const { revision, unread } = useAdminRealtime();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [local, setLocal] = useState(0); // recharge après un marquage
  const { result } = useRemote(open ? `notif:${page}:${revision}:${local}` : null, () => fetchNotifications(page));
  const count = unread?.notifications ?? 0;

  const markAll = async () => {
    if ((await markNotificationsRead({ all: true })).ok) setLocal((n) => n + 1);
  };
  const markOne = (id: string) => markNotificationsRead({ ids: [id] });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Notifications, ${count} non lue${count > 1 ? "s" : ""}`}
        className="relative flex h-10 w-10 items-center justify-center border-2 border-ink bg-paper transition-colors hover:bg-ink hover:text-cream"
      >
        <BellIcon />
        {count > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center bg-accent px-1 font-mono text-[0.65rem] text-cream">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-30 w-80 border-2 border-ink bg-cream shadow-[5px_5px_0_rgba(33,26,18,0.12)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="label-mono text-ink-soft">Notifications</p>
            <button onClick={markAll} disabled={count === 0} className="font-mono text-xs text-accent hover:underline disabled:opacity-40">
              Tout marquer lu
            </button>
          </div>
          {!result ? <p className="px-4 py-3 font-mono text-xs text-ink-faint">Chargement…</p> : null}
          {result && !result.ok ? <p className="px-4 py-3 font-mono text-xs text-accent-ink" role="alert">{result.error}</p> : null}
          {result?.ok ? (
            <>
              {result.data.items.length === 0 ? <p className="px-4 py-3 text-sm text-ink-faint">Aucune notification.</p> : null}
              <ul className="max-h-80 overflow-y-auto">
                {result.data.items.map((n) => (
                  <li key={n.id} className={cn("border-b border-line text-sm", !n.read && "bg-accent/10")}>
                    <Link href={notificationHref(n.type)} onClick={() => { if (!n.read) markOne(n.id); setOpen(false); }} className="block px-4 py-3 hover:bg-paper">
                      <span className="flex items-center gap-2">
                        <span className="bg-ink px-1.5 py-0.5 font-mono text-[0.6rem] text-cream">{notificationKind(n.type)}</span>
                        <span className="font-mono text-[0.65rem] text-ink-faint">{formatParis(n.createdAt)}</span>
                      </span>
                      <span className="mt-1 block leading-snug">{notificationText(n)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {result.data.totalPages > 1 ? (
                <div className="flex justify-between px-4 py-2 font-mono text-xs">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">← Récentes</button>
                  <span className="text-ink-faint">{page} / {result.data.totalPages}</span>
                  <button disabled={page >= result.data.totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">Anciennes →</button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
