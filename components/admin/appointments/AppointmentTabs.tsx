"use client";

import { APPOINTMENT_STAGES, APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/booking/status";
import { cn } from "@/lib/utils";

/** Onglets par statut, avec les totaux réels renvoyés par l'API. */
export function AppointmentTabs({
  active,
  counts,
  onSelect,
}: {
  active: AppointmentStatus | null;
  counts: Record<AppointmentStatus, number> | null;
  onSelect: (status: AppointmentStatus | null) => void;
}) {
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  const tabs: Array<{ key: AppointmentStatus | null; label: string; count?: number; tone?: string }> = [
    { key: null, label: "Tous", count: total },
    ...APPOINTMENT_STATUSES.map((s) => ({ key: s, label: APPOINTMENT_STAGES[s].label, count: counts?.[s], tone: APPOINTMENT_STAGES[s].tone })),
  ];
  return (
    <div role="tablist" aria-label="Statuts des rendez-vous" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-6">
      {tabs.map((tab) => (
        <button
          key={tab.key ?? "ALL"}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onSelect(tab.key)}
          className={cn(
            "border-2 px-3 py-2.5 text-left transition-colors",
            tab.tone ?? "border-ink bg-cream",
            active === tab.key ? "ring-2 ring-ink ring-offset-2" : "hover:border-ink"
          )}
        >
          <span className="block truncate font-mono text-[0.65rem] text-ink-soft">{tab.label}</span>
          <span className="block font-display text-2xl">{tab.count ?? "…"}</span>
        </button>
      ))}
    </div>
  );
}
