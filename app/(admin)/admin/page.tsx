import { AdminPage, PageTitle } from "@/components/admin/ui";
import { getPipelineSummary } from "@/lib/server/crm";
import { countUpcomingAppointments, getNextAppointment } from "@/lib/server/appointments";
import { getMessageStats, getRecentConversations, getRecentNotifications, getReminders, getVisitSummary } from "@/lib/server/dashboard";
import { StatTiles } from "@/components/admin/dashboard/StatTiles";
import { ActivityPanel } from "@/components/admin/dashboard/ActivityPanel";
import { PipelinePanel } from "@/components/admin/dashboard/PipelinePanel";
import { NextAppointmentPanel } from "@/components/admin/dashboard/NextAppointmentPanel";
import { RecentConversations, Reminders } from "@/components/admin/dashboard/SideLists";

/** Tableau de bord : toutes les données sont réelles (base + compteurs Redis). */
export default async function AdminOverview() {
  const [pipeline, appointments, nextRdv, messages, visits, activity, conversations, reminders] = await Promise.all([
    getPipelineSummary(),
    countUpcomingAppointments(),
    getNextAppointment(),
    getMessageStats(),
    getVisitSummary(),
    getRecentNotifications(),
    getRecentConversations(),
    getReminders(),
  ]);
  const newLeads = pipeline.stages.find((s) => s.status === "NEW")?.count ?? 0;

  return (
    <AdminPage>
      <PageTitle
        eyebrow="Dashboard"
        title="Vue d'ensemble"
        description="La place de marché du studio en un coup d'œil : ce qui arrive, ce qui attend, ce qui roule."
      />

      <StatTiles
        tiles={[
          { label: "Leads actifs", value: String(pipeline.open), sub: `${newLeads} nouveau(x) à traiter`, href: "/admin/leads" },
          { label: "Messages non lus", value: String(messages.unread), sub: `${messages.conversations} conversation(s)`, href: "/admin/messages" },
          { label: "RDV à venir", value: String(appointments.upcoming), sub: `${appointments.pending} en attente de réponse`, href: "/admin/agenda" },
          {
            label: "Pages vues / 30 j",
            value: visits ? visits.total.toLocaleString("fr-FR") : "—",
            sub: !visits ? "statistiques indisponibles" : visits.trend === null ? "pas de période précédente" : `${visits.trend > 0 ? "+" : ""}${visits.trend} % vs 30 j préc.`,
            href: "/admin/analytics",
          },
        ]}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <ActivityPanel items={activity} />
        <div className="space-y-6">
          <PipelinePanel pipeline={pipeline} />
          <NextAppointmentPanel next={nextRdv} />
        </div>
      </div>

      <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
        <RecentConversations items={conversations} />
        <Reminders items={reminders} />
      </div>
    </AdminPage>
  );
}
