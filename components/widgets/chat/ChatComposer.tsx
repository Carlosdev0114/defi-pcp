"use client";

import { useState } from "react";
import { CHAT_MAX_LENGTH } from "@/lib/chat/client";

/** Saisie de la question. Désactivée pendant l'envoi et pendant le délai
 * imposé par l'API (Retry-After), avec le compte à rebours affiché. */
export function ChatComposer({
  onSend,
  pending,
  secondsLeft,
}: {
  onSend: (question: string) => void;
  pending: boolean;
  secondsLeft: number;
}) {
  const [draft, setDraft] = useState("");
  const waiting = secondsLeft > 0;
  const disabled = pending || waiting;
  const question = draft.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || !question) return;
    onSend(question);
    setDraft("");
  };

  return (
    <form onSubmit={submit} className="border-t border-line bg-paper px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          disabled={disabled}
          placeholder={waiting ? "Patientez…" : "Écrire une question…"}
          className="w-full border border-line-strong bg-cream px-3 py-2 font-mono text-sm placeholder:text-ink-faint disabled:opacity-60"
          aria-label="Votre question"
        />
        <button
          type="submit"
          disabled={disabled || !question}
          aria-label="Envoyer la question"
          className="bg-ink px-3 py-2 font-mono text-cream transition-colors hover:bg-accent disabled:opacity-40"
        >
          →
        </button>
      </div>
      <p className="mt-2 font-mono text-[0.65rem] text-ink-faint" aria-live="polite">
        {waiting
          ? `Nouvel envoi possible dans ${secondsLeft} s.`
          : "Réponses fondées uniquement sur les données publiques du portfolio."}
      </p>
    </form>
  );
}
