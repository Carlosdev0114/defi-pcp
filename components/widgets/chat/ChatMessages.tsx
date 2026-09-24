"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: number;
  role: "user" | "assistant" | "notice";
  text: string;
  sources?: string[];
};

/**
 * Fil de discussion. Tout contenu (question, réponse de l'IA, erreur) est
 * rendu comme TEXTE via React, qui l'échappe : jamais de HTML ni de Markdown
 * interprété. C'est ce qui compense 'unsafe-inline' sur les pages publiques.
 */
export function ChatMessages({ messages, pending }: { messages: ChatMessage[]; pending: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length, pending]);

  return (
    <div className="space-y-3" aria-live="polite">
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "max-w-[85%] px-3 py-2.5",
            m.role === "user" && "ml-auto bg-ink text-cream",
            m.role === "assistant" && "border border-line-strong bg-paper",
            m.role === "notice" && "border-2 border-accent bg-accent/10 font-mono text-xs text-accent-ink"
          )}
          role={m.role === "notice" ? "alert" : undefined}
        >
          <p className="whitespace-pre-wrap break-words">{m.text}</p>
          {m.sources?.length ? (
            <p className="mt-2 font-mono text-[0.65rem] text-ink-faint">Sources : {m.sources.join(" · ")}</p>
          ) : null}
        </div>
      ))}
      {pending ? (
        <p className="font-mono text-xs text-ink-faint" role="status">
          L'assistant cherche dans les données publiques…
        </p>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
