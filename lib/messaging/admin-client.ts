import { requestJson } from "@/lib/http/client";
import type { ThreadMessage } from "@/lib/messaging/client";

// Messagerie, côté back-office (routes admin : 401 sans session).

export const CONVERSATIONS_PAGE_SIZE = 20;

export type AdminConversation = {
  id: string;
  visitorName: string | null;
  visitorEmail: string | null;
  updatedAt: string;
  unread: number;
  messages: ThreadMessage[]; // dernier message seulement (aperçu)
  _count: { messages: number };
};

export type ConversationsPage = {
  items: AdminConversation[];
  page: number;
  totalPages: number;
  total: number;
};

export const fetchConversations = (page: number) =>
  requestJson<ConversationsPage>(`/api/admin/conversations?page=${page}&pageSize=${CONVERSATIONS_PAGE_SIZE}`);

export const fetchAdminThread = (id: string, before?: string) =>
  requestJson<{ items: ThreadMessage[]; nextCursor: string | null }>(
    `/api/admin/conversations/${encodeURIComponent(id)}/messages?limit=30${before ? `&before=${encodeURIComponent(before)}` : ""}`
  );

export const replyToConversation = (id: string, content: string) =>
  requestJson<ThreadMessage>(`/api/admin/conversations/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });

export const markConversationRead = (id: string) =>
  requestJson<{ updated: number }>(`/api/admin/conversations/${encodeURIComponent(id)}/read`, { method: "POST" });
