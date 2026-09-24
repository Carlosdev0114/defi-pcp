import { requestJson } from "@/lib/http/client";
import type { StartConversationInput } from "@/lib/schemas/message";

// Messagerie : types partagés et appels du widget visiteur.

export type ThreadMessage = { id: string; sender: "VISITOR" | "ADMIN" | "AI"; content: string; createdAt: string };

export type ThreadResponse =
  | { conversation: null }
  | { changed: false; version: number }
  | { changed: true; version: number; conversation: { visitorName: string | null }; messages: ThreadMessage[] };

/** Fusionne sans doublon et dans l'ordre chronologique (pur, testable). */
export function mergeMessages(current: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** Poll du visiteur : `since` absent = rafraîchissement complet. */
export function fetchThread(opts: { since?: number; after?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.since !== undefined) params.set("since", String(opts.since));
  if (opts.after) params.set("after", opts.after);
  const qs = params.toString();
  return requestJson<ThreadResponse>(`/api/public/conversations/current${qs ? `?${qs}` : ""}`);
}

export const startConversation = (input: StartConversationInput) =>
  requestJson<{ conversation: { visitorName: string | null }; messages: ThreadMessage[] }>("/api/public/conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const sendVisitorMessage = (content: string) =>
  requestJson<{ message: ThreadMessage }>("/api/public/conversations/current/messages", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
