"use client";

import { LEAD_STAGES, LEAD_STATUSES, type LeadStatus } from "@/lib/crm/stages";
import type { PipelineSummary } from "@/lib/crm/client";
import { cn } from "@/lib/utils";

/** Onglets par stade, avec les totaux réels renvoyés par l'API. */
export function StatusTabs({
  active,
  pipeline,
  onSelect,
}: {
  active: LeadStatus | null;
  pipeline: PipelineSummary | null;
  onSelect: (status: LeadStatus | null) => void;
}) {
  const countOf = (status: LeadStatus) => pipeline?.stages.find((s) => s.status === status)?.count;
  const tabs: Array<{ key: LeadStatus | null; label: string; count?: number; tone?: string }> = [
    { key: null, label: "Tous", count: pipeline?.total },
    ...LEAD_STATUSES.map((s) => ({ key: s, label: LEAD_STAGES[s].label, count: countOf(s), tone: LEAD_STAGES[s].tone })),
  ];

  return (
    <div role="tablist" aria-label="Stades du pipeline" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-7">
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
          <span className="block font-mono text-[0.65rem] text-ink-soft">{tab.label}</span>
          <span className="block font-display text-2xl">{tab.count ?? "…"}</span>
        </button>
      ))}
    </div>
  );
}
