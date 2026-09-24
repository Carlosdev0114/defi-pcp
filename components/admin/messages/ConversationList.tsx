"use client";

import type { AdminConversation } from "@/lib/messaging/admin-client";
import { formatParis } from "@/lib/time/paris";
import { cn } from "@/lib/utils";

export function ConversationList({
  items,
  selectedId,
  onSelect,
}: {
  items: AdminConversation[];
  selectedId: string | null;
  onSelect: (c: AdminConversation) => void;
}) {
  if (items.length === 0) return <p className="p-4 text-sm text-ink-faint">Aucune conversation pour le moment.</p>;
  return (
    <ul>
      {items.map((c) => {
        const last = c.messages[0];
        return (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c)}
              aria-current={c.id === selectedId ? "true" : undefined}
              className={cn("w-full border-b border-line px-4 py-3 text-left transition-colors", c.id === selectedId ? "bg-accent/15" : "hover:bg-paper")}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-sm font-semibold">{c.visitorName || "Visiteur anonyme"}</span>
                {c.unread > 0 ? (
                  <span className="shrink-0 bg-accent px-1.5 font-mono text-[0.6rem] text-cream" aria-label={`${c.unread} non lu(s)`}>
                    {c.unread}
                  </span>
                ) : null}
              </span>
              {/* Aperçu : texte brut tronqué, jamais interprété. */}
              <span className="mt-0.5 block truncate text-xs text-ink-soft">
                {last ? `${last.sender === "ADMIN" ? "Vous : " : ""}${last.content}` : "—"}
              </span>
              <span className="mt-0.5 block font-mono text-[0.6rem] text-ink-faint">{formatParis(c.updatedAt)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
