"use client";

import { useState } from "react";
import { usePoll } from "@/lib/hooks/use-poll";
import { fetchThread, mergeMessages, sendVisitorMessage, startConversation, type ThreadMessage } from "@/lib/messaging/client";
import type { StartConversationInput } from "@/lib/schemas/message";
import type { ApiResult } from "@/lib/http/client";
import { useCooldown } from "./chat/useCooldown";
import { StartConversationForm } from "./messaging/StartConversationForm";
import { VisitorThread } from "./messaging/VisitorThread";
import { VisitorComposer } from "./messaging/VisitorComposer";

const VISITOR_POLL_MS = 5_000;

type Phase = "loading" | "none" | "thread";

/** Messagerie visiteur → propriétaire du portfolio (nom lu dans le profil). Le visiteur ne voit que SA conversation
 * (cookie signé posé par le serveur). Nouveaux messages : polling 5 s,
 * uniquement quand ce panneau est ouvert et l'onglet visible. */
export function MessagingPanel({ onClose, ownerName }: { onClose: () => void; ownerName: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const { secondsLeft, start } = useCooldown();

  const failed = (result: Extract<ApiResult<unknown>, { ok: false }>) => {
    setNotice(result.error);
    if (result.retryAfter) start(result.retryAfter);
  };

  // Chargement initial et polling (le poll ne tourne que si une conversation existe).
  usePoll(async (full) => {
    const last = messages[messages.length - 1]?.id;
    const result = await fetchThread(full || phase !== "thread" ? {} : { since: version, after: last });
    if (!result.ok) return;
    const data = result.data;
    if ("conversation" in data && data.conversation === null) {
      setPhase("none");
      return;
    }
    if (!("changed" in data) || !data.changed) return;
    setVersion(data.version);
    setMessages((current) => (full ? data.messages : mergeMessages(current, data.messages)));
    setPhase("thread");
  }, VISITOR_POLL_MS, phase !== "none");

  const begin = async (input: StartConversationInput) => {
    setNotice(null);
    const result = await startConversation(input);
    if (result.ok) {
      setMessages(result.data.messages);
      setPhase("thread");
    } else if (result.status === 409) setPhase("loading"); // conversation déjà ouverte : on la recharge
    else failed(result);
  };

  const send = async (content: string) => {
    setNotice(null);
    const result = await sendVisitorMessage(content);
    if (result.ok) {
      setMessages((current) => mergeMessages(current, [result.data.message]));
      return true;
    }
    if (result.status === 404) setPhase("none");
    failed(result);
    return false;
  };

  return (
    <aside className="flex h-[min(70vh,560px)] w-[min(94vw,400px)] flex-col border-2 border-ink bg-cream shadow-[6px_6px_0_rgba(33,26,18,0.12)]">
      <header className="flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-cream">
        <div>
          <p className="font-mono text-sm font-medium">{ownerName ? `Messagerie — ${ownerName}` : "Messagerie"}</p>
          <p className="font-mono text-[0.65rem] text-cream/60">Réponse sous 24 h ouvrées</p>
        </div>
        <button onClick={onClose} aria-label="Fermer la messagerie" className="px-1 text-cream/70 hover:text-cream">✕</button>
      </header>

      {notice ? <p className="border-b border-accent bg-accent/10 px-4 py-2 font-mono text-xs text-accent-ink" role="alert">{notice}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {phase === "loading" ? <p className="p-4 font-mono text-xs text-ink-faint" role="status">Chargement…</p> : null}
        {phase === "none" ? <StartConversationForm onStart={begin} disabled={secondsLeft > 0} /> : null}
        {phase === "thread" ? <div className="px-3 py-3"><VisitorThread messages={messages} ownerName={ownerName} /></div> : null}
      </div>

      {phase === "thread" ? <VisitorComposer onSend={send} secondsLeft={secondsLeft} /> : null}
    </aside>
  );
}
