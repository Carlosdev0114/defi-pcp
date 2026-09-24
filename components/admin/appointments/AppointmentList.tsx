"use client";

import { APPOINTMENT_STAGES } from "@/lib/booking/status";
import type { AdminAppointment } from "@/lib/booking/client";
import { formatParis } from "@/lib/time/paris";
import { cn } from "@/lib/utils";

export function AppointmentList({
  items,
  selectedId,
  onSelect,
}: {
  items: AdminAppointment[];
  selectedId: string | null;
  onSelect: (a: AdminAppointment) => void;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-ink-faint">Aucun rendez-vous.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.id}>
          <button
            onClick={() => onSelect(a)}
            aria-current={a.id === selectedId ? "true" : undefined}
            className={cn(
              "flex w-full items-start justify-between gap-3 px-2 py-3 text-left transition-colors",
              a.id === selectedId ? "bg-accent/10" : "hover:bg-paper"
            )}
          >
            <span className="min-w-0">
              <span className="block font-mono text-sm font-semibold">{formatParis(a.startAt)}</span>
              <span className="block truncate text-sm">{a.visitorName} · {a.service.name}</span>
              <span className="block font-mono text-[0.6rem] text-ink-faint">{a.reference}</span>
            </span>
            <span className={cn("shrink-0 border px-1.5 py-0.5 font-mono text-[0.6rem]", APPOINTMENT_STAGES[a.status].tone)}>
              {APPOINTMENT_STAGES[a.status].label}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
