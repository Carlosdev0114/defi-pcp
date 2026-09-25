"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CloseIcon } from "@/components/ui/icons";

// Panneaux chargés à la première ouverture seulement : leur code (et Zod, via
// les schémas de la messagerie) ne part plus avec chaque page publique.
const ChatPanel = dynamic(() => import("./ChatPanel").then((m) => m.ChatPanel), { ssr: false });
const MessagingPanel = dynamic(() => import("./MessagingPanel").then((m) => m.MessagingPanel), { ssr: false });

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="4" y="8" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8V4m0 0h2m-2 0h-2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 13h.01M15 13h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M4 5h16v11H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="M8 9.5h8M8 12.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

export function WidgetStack({ chatEnabled, ownerName }: { chatEnabled: boolean; ownerName: string }) {
  const [active, setActive] = useState<"chat" | "msg" | null>(null);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {active === "chat" && chatEnabled ? <ChatPanel onClose={() => setActive(null)} ownerName={ownerName} /> : null}
      {active === "msg" ? <MessagingPanel onClose={() => setActive(null)} ownerName={ownerName} /> : null}

      <div className="flex gap-2">
        <button
          onClick={() => setActive((v) => (v === "msg" ? null : "msg"))}
          aria-label={active === "msg" ? "Masquer la messagerie" : "Ouvrir la messagerie"}
          className="flex h-12 w-12 items-center justify-center border-2 border-ink bg-cream text-ink transition-colors hover:bg-ink hover:text-cream"
        >
          {active === "msg" ? <CloseIcon /> : <MessageIcon />}
        </button>
        {chatEnabled ? (
          <button
            onClick={() => setActive((v) => (v === "chat" ? null : "chat"))}
            aria-label={active === "chat" ? "Masquer le chatbot" : "Ouvrir le chatbot"}
            className={`flex h-12 w-12 items-center justify-center border-2 border-ink text-cream transition-colors ${
              active === "chat" ? "bg-ink" : "bg-accent hover:bg-accent-strong"
            }`}
          >
            {active === "chat" ? <CloseIcon /> : <BotIcon />}
          </button>
        ) : null}
      </div>
    </div>
  );
}