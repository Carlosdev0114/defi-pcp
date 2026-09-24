import { requestJson } from "@/lib/http/client";

export const CHAT_MAX_LENGTH = 500; // même borne que chatSchema côté serveur

export type ChatAnswer = { answer: string; sources: string[] };

export type AskOutcome =
  | { kind: "answer"; answer: string; sources: string[] }
  /** 429 (nos limites) ou 503 (assistant saturé) : attendre `retryAfter` s. */
  | { kind: "wait"; error: string; retryAfter: number }
  | { kind: "error"; error: string };

export async function askAssistant(question: string): Promise<AskOutcome> {
  const result = await requestJson<ChatAnswer>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
  if (result.ok) {
    const { answer, sources } = result.data ?? { answer: "", sources: [] };
    return { kind: "answer", answer: String(answer ?? ""), sources: Array.isArray(sources) ? sources.map(String) : [] };
  }
  if (result.retryAfter !== null) return { kind: "wait", error: result.error, retryAfter: result.retryAfter };
  return { kind: "error", error: result.error };
}

/** Secondes restantes avant de pouvoir renvoyer (0 = envoi possible). */
export function remainingSeconds(blockedUntil: number | null, now: number): number {
  if (blockedUntil === null) return 0;
  return Math.max(0, Math.ceil((blockedUntil - now) / 1000));
}
