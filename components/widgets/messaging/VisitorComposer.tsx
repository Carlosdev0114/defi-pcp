"use client";

import { useState } from "react";
import { MESSAGE_MAX, messageSchema } from "@/lib/schemas/message";
import { SendIcon } from "@/components/ui/icons";

/** Envoi d'un message (même schéma Zod que l'API), bloqué pendant le délai
 * imposé par l'API (Retry-After) avec compte à rebours. */
export function VisitorComposer({
  onSend,
  secondsLeft,
}: {
  onSend: (content: string) => Promise<boolean>;
  secondsLeft: number;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const disabled = sending || secondsLeft > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = messageSchema.safeParse({ content: draft });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    setSending(true);
    const ok = await onSend(parsed.data.content);
    setSending(false);
    if (ok) setDraft("");
  };

  return (
    <form onSubmit={submit} className="border-t border-line bg-paper px-3 py-2.5">
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MESSAGE_MAX}
          disabled={disabled}
          placeholder={secondsLeft > 0 ? "Patientez…" : "Votre message…"}
          aria-label="Votre message"
          className="w-full border border-line-strong bg-cream px-3 py-2 font-mono text-sm placeholder:text-ink-faint disabled:opacity-60"
        />
        <button type="submit" disabled={disabled} aria-label="Envoyer le message" className="bg-ink p-2.5 text-cream transition-colors hover:bg-accent disabled:opacity-40">
          <SendIcon />
        </button>
      </div>
      {error ? <p className="mt-1.5 font-mono text-[0.65rem] text-accent-ink" role="alert">{error}</p> : null}
      {secondsLeft > 0 ? <p className="mt-1.5 font-mono text-[0.65rem] text-ink-faint">Nouvel envoi possible dans {secondsLeft} s.</p> : null}
    </form>
  );
}
