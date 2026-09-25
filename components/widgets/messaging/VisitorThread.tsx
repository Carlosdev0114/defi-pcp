"use client";

import { useEffect, useRef } from "react";
import type { ThreadMessage } from "@/lib/messaging/client";
import { formatParis } from "@/lib/time/paris";
import { cn } from "@/lib/utils";

/** Fil du visiteur. Tout est rendu en TEXTE par React (échappé) : jamais de
 * HTML ni de Markdown interprété. */
export function VisitorThread({ messages, ownerName }: { messages: ThreadMessage[]; ownerName: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  return (
    <div className="space-y-3" aria-live="polite">
      {messages.map((m) => {
        const mine = m.sender === "VISITOR";
        return (
          <div
            key={m.id}
            className={cn("max-w-[85%] px-3 py-2 text-[0.8rem] leading-relaxed", mine ? "ml-auto bg-ink text-cream" : "border border-line-strong bg-paper")}
          >
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
            <p className={cn("mt-1 font-mono text-[0.6rem]", mine ? "text-cream/60" : "text-ink-faint")}>
              {mine ? "Vous" : ownerName || "Réponse"} · {formatParis(m.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
