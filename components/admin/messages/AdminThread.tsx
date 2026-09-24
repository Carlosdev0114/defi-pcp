"use client";

import { useState } from "react";
import { useRemote } from "@/lib/hooks/use-remote";
import { fetchAdminThread, replyToConversation, type AdminConversation } from "@/lib/messaging/admin-client";
import { mergeMessages, type ThreadMessage } from "@/lib/messaging/client";
import { formatParis } from "@/lib/time/paris";
import { cn } from "@/lib/utils";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { ReplyForm } from "./ReplyForm";

/** Fil d'une conversation côté admin : 30 derniers messages, rechargés à chaque
 * événement temps réel ; les plus anciens à la demande (curseur). Texte brut. */
export function AdminThread({ conversation, revision, onReplied }: { conversation: AdminConversation; revision: number; onReplied: () => void }) {
  const { result } = useRemote(`thread:${conversation.id}:${revision}`, () => fetchAdminThread(conversation.id));
  const [older, setOlder] = useState<{ id: string; items: ThreadMessage[]; cursor: string | null } | null>(null);

  const recent = result?.ok ? result.data.items : [];
  const olderItems = older?.id === conversation.id ? older.items : [];
  const messages = mergeMessages(olderItems, recent);
  const cursor = older?.id === conversation.id ? older.cursor : result?.ok ? result.data.nextCursor : null;

  const loadOlder = async () => {
    if (!cursor) return;
    const page = await fetchAdminThread(conversation.id, cursor);
    if (page.ok) setOlder({ id: conversation.id, items: mergeMessages(olderItems, page.data.items), cursor: page.data.nextCursor });
  };

  const reply = async (content: string) => {
    const res = await replyToConversation(conversation.id, content);
    if (!res.ok) return res.error;
    onReplied();
    return null;
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b-2 border-line bg-paper px-4 py-3">
        <p className="font-mono text-sm font-semibold">{conversation.visitorName || "Visiteur anonyme"}</p>
        <p className="text-xs text-ink-faint">{conversation.visitorEmail || "E-mail non communiqué"}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/messages" /> : null}
        {cursor ? (
          <button onClick={loadOlder} className="mx-auto block font-mono text-xs text-ink-soft hover:text-accent">
            ↑ Messages plus anciens
          </button>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={cn("max-w-[75%] px-3 py-2.5 text-sm leading-relaxed", m.sender === "ADMIN" ? "ml-auto bg-ink text-cream" : "border border-line-strong bg-paper")}>
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
            <p className={cn("mt-1 font-mono text-[0.6rem]", m.sender === "ADMIN" ? "text-cream/60" : "text-ink-faint")}>
              {m.sender === "ADMIN" ? "Vous" : conversation.visitorName || "Visiteur"} · {formatParis(m.createdAt)}
            </p>
          </div>
        ))}
      </div>
      <ReplyForm onReply={reply} />
    </div>
  );
}
