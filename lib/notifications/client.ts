import { requestJson } from "@/lib/http/client";
import { stageLabel, isLeadStatus } from "@/lib/crm/stages";
import { formatParis } from "@/lib/time/paris";

// Notifications du back-office : types, texte affiché, appels API.

export type AdminNotification = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

export type UpdatesResponse =
  | { changed: false; version: number }
  | { changed: true; version: number; unread: { notifications: number; messages: number } };

const str = (v: unknown, fallback = "—") => (typeof v === "string" && v.trim() ? v : fallback);

/** Étiquette courte du type (pastille). */
export function notificationKind(type: string): string {
  return ({ message: "Message", lead: "Lead", booking: "Résa", contact: "Contact" } as Record<string, string>)[type] ?? "Info";
}

/** Texte lisible construit depuis le payload, en TEXTE (jamais de HTML). */
export function notificationText(n: Pick<AdminNotification, "type" | "payload">): string {
  const p = n.payload ?? {};
  switch (n.type) {
    case "message":
      return `Nouveau message de ${str(p.name, "Visiteur")}.`;
    case "lead":
      if (isLeadStatus(p.from) && isLeadStatus(p.to)) {
        return `Lead ${str(p.name)} : ${stageLabel(p.from)} → ${stageLabel(p.to)}.`;
      }
      return `Nouveau lead : ${str(p.name)}${typeof p.subject === "string" && p.subject ? ` — ${p.subject}` : ""}.`;
    case "booking":
      return `Nouvelle réservation : ${str(p.name)} — ${str(p.service)}${typeof p.startAt === "string" ? `, ${formatParis(p.startAt)}` : ""}.`;
    case "contact":
      return `Nouveau contact : ${str(p.name)}.`;
    default:
      return "Nouvelle activité.";
  }
}

/** Lien vers l'écran concerné. */
export function notificationHref(type: string): string {
  return ({ message: "/admin/messages", lead: "/admin/leads", booking: "/admin/agenda", contact: "/admin/leads" } as Record<string, string>)[type] ?? "/admin";
}

export const fetchUpdates = (since?: number) =>
  requestJson<UpdatesResponse>(`/api/admin/updates${since !== undefined ? `?since=${since}` : ""}`);

export const NOTIFICATIONS_PAGE_SIZE = 10;

export const fetchNotifications = (page: number) =>
  requestJson<{ items: AdminNotification[]; page: number; totalPages: number; total: number; unread: number }>(
    `/api/admin/notifications?page=${page}&pageSize=${NOTIFICATIONS_PAGE_SIZE}`
  );

export const markNotificationsRead = (body: { ids: string[] } | { all: true }) =>
  requestJson<{ updated: number }>("/api/admin/notifications", { method: "PATCH", body: JSON.stringify(body) });
