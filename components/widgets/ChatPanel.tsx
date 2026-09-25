"use client";

import { useRef, useState } from "react";
import { askAssistant } from "@/lib/chat/client";
import { ChatMessages, type ChatMessage } from "./chat/ChatMessages";
import { ChatComposer } from "./chat/ChatComposer";
import { useCooldown } from "./chat/useCooldown";

const suggestedQuestions = [
  "Quelles technos au quotidien ?",
  "Tu as des disponibilités bientôt ?",
  "Quels services proposes-tu ?",
];

/** Nom lu dans le profil (jamais codé en dur) ; formulation neutre s'il est vide. */
const welcome = (ownerName: string) =>
  `Bonjour 👋 Je peux répondre à des questions sur le parcours, les projets et les compétences ${
    ownerName ? `de ${ownerName}` : "de la personne présentée ici"
  }, à partir de ses données publiques.`;

export function ChatPanel({ onClose, ownerName }: { onClose: () => void; ownerName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const { secondsLeft, start } = useCooldown();
  const nextId = useRef(0);

  const push = (role: ChatMessage["role"], text: string, sources?: string[]) =>
    setMessages((list) => [...list, { id: nextId.current++, role, text, sources }]);

  const send = async (question: string) => {
    if (pending || secondsLeft > 0) return;
    push("user", question);
    setPending(true);
    const outcome = await askAssistant(question);
    setPending(false);

    if (outcome.kind === "answer") push("assistant", outcome.answer, outcome.sources);
    else if (outcome.kind === "wait") {
      push("notice", outcome.error);
      start(outcome.retryAfter);
    } else push("notice", outcome.error);
  };

  return (
    <aside className="flex max-h-[70vh] w-[min(92vw,380px)] flex-col border-2 border-ink bg-cream shadow-[6px_6px_0_rgba(33,26,18,0.12)]">
      <header className="flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-cream">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
          <div>
            <p className="font-mono text-sm font-medium">{ownerName ? `Assistant de ${ownerName}` : "Assistant du portfolio"}</p>
            <p className="font-mono text-[0.65rem] text-cream/60">
              Réponses basées sur les données publiques du portfolio
            </p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fermer le chatbot" className="px-1 text-cream/70 hover:text-cream">
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
        <div className="max-w-[85%] border border-line-strong bg-paper px-3 py-2.5">{welcome(ownerName)}</div>
        {messages.length === 0 ? (
          <>
            <p className="label-mono text-ink-faint">Questions suggérées</p>
            <div className="flex flex-col gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={pending || secondsLeft > 0}
                  className="border border-line px-3 py-2 text-left font-mono text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <ChatMessages messages={messages} pending={pending} />
      </div>

      <ChatComposer onSend={send} pending={pending} secondsLeft={secondsLeft} />
    </aside>
  );
}
