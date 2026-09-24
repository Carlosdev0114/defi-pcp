"use client";

import { useState } from "react";
import { MESSAGE_MAX, messageSchema } from "@/lib/schemas/message";
import { SendIcon } from "@/components/ui/icons";

/** Réponse de l'admin (même schéma Zod que l'API). */
export function ReplyForm({ onReply }: { onReply: (content: string) => Promise<string | null> }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = messageSchema.safeParse({ content: draft });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSending(true);
    const failure = await onReply(parsed.data.content);
    setSending(false);
    setError(failure);
    if (!failure) setDraft("");
  };

  return (
    <form onSubmit={submit} className="border-t-2 border-line bg-paper px-3 py-3">
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MESSAGE_MAX}
          disabled={sending}
          placeholder="Répondre…"
          aria-label="Réponse"
          className="w-full border-2 border-line-strong bg-cream px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button type="submit" disabled={sending} aria-label="Envoyer la réponse" className="bg-ink p-2.5 text-cream transition-colors hover:bg-accent disabled:opacity-40">
          <SendIcon />
        </button>
      </div>
      {error ? <p className="mt-1.5 font-mono text-xs text-accent-ink" role="alert">{error}</p> : null}
    </form>
  );
}
