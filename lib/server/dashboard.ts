import "server-only";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/lib/server/db";
import { getVisitStats } from "@/lib/server/visits";

// Données réelles du tableau de bord /admin (hors CRM et RDV, déjà ailleurs).

const MESSAGE_UNREAD = { type: "message", read: false } as const;

/** Messages non lus (notifications `message` non lues) et conversations concernées. */
export async function getMessageStats() {
  const unread = await db.notification.findMany({ where: MESSAGE_UNREAD, select: { payload: true }, take: 1000 });
  const conversations = new Set(
    unread.map((n) => (n.payload as { conversationId?: unknown } | null)?.conversationId).filter((id) => typeof id === "string")
  );
  return { unread: unread.length, conversations: conversations.size };
}

/** Pages vues sur 30 jours et évolution vs les 30 jours précédents (null si Redis indisponible). */
export async function getVisitSummary() {
  try {
    const stats = await getVisitStats(30);
    const trend = stats.previousTotal > 0 ? Math.round(((stats.total - stats.previousTotal) / stats.previousTotal) * 100) : null;
    return { total: stats.total, trend };
  } catch (error) {
    unstable_rethrow(error); // signaux internes de Next (rendu dynamique…) : pas une panne
    console.error("Tableau de bord : statistiques de visites indisponibles", error);
    return null;
  }
}

export function getRecentNotifications(take = 4) {
  return db.notification.findMany({ orderBy: { createdAt: "desc" }, take, select: { id: true, type: true, payload: true, read: true, createdAt: true } });
}

export function getRecentConversations(take = 4) {
  return db.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, visitorName: true, updatedAt: true, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { sender: true } } },
  });
}

const STALE_PROPOSAL_DAYS = 7;

/** Rappels calculés depuis les données : ce qui attend une action de l'admin. */
export async function getReminders(now = new Date()) {
  const staleSince = new Date(now.getTime() - STALE_PROPOSAL_DAYS * 86_400_000);
  const [pendingAppointments, newLeads, staleProposals, conversations] = await Promise.all([
    db.appointment.count({ where: { status: "PENDING", startAt: { gte: now } } }),
    db.lead.count({ where: { status: "NEW" } }),
    db.lead.count({ where: { status: "PROPOSAL", updatedAt: { lt: staleSince } } }),
    db.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { sender: true } } },
    }),
  ]);
  const awaitingReply = conversations.filter((c) => c.messages[0]?.sender === "VISITOR").length;

  const reminders: { text: string; href: string }[] = [];
  if (pendingAppointments) reminders.push({ text: `${pendingAppointments} rendez-vous attend(ent) votre confirmation.`, href: "/admin/agenda" });
  if (awaitingReply) reminders.push({ text: `${awaitingReply} conversation(s) attend(ent) une réponse.`, href: "/admin/messages" });
  if (newLeads) reminders.push({ text: `${newLeads} lead(s) au stade « Nouveau » à contacter.`, href: "/admin/leads" });
  if (staleProposals) reminders.push({ text: `${staleProposals} proposition(s) sans suivi depuis ${STALE_PROPOSAL_DAYS} jours.`, href: "/admin/leads" });
  return reminders;
}
