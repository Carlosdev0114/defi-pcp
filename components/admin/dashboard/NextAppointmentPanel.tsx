import Link from "next/link";
import { Panel } from "@/components/admin/ui";
import { APPOINTMENT_STAGES, type AppointmentStatus } from "@/lib/booking/status";
import { formatParis } from "@/lib/time/paris";

type Next = { startAt: Date; status: AppointmentStatus; visitorName: string; service: { name: string } } | null;

export function NextAppointmentPanel({ next }: { next: Next }) {
  return (
    <Panel title="Prochain RDV">
      {next ? (
        <>
          <p className="font-display text-2xl">{next.service.name} — {next.visitorName}</p>
          <p className="mt-1 font-mono text-sm text-accent">
            {formatParis(next.startAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} (Paris)
          </p>
          <p className="mt-1 font-mono text-xs text-ink-faint">{APPOINTMENT_STAGES[next.status].label}</p>
        </>
      ) : (
        <p className="text-sm text-ink-faint">Aucun rendez-vous à venir.</p>
      )}
      <Link href="/admin/agenda" className="mt-4 inline-block font-mono text-xs text-ink-soft hover:text-accent">
        Ouvrir l'agenda →
      </Link>
    </Panel>
  );
}
