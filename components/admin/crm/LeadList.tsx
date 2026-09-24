"use client";

import { LEAD_STAGES } from "@/lib/crm/stages";
import { formatDate, formatEuros, type LeadListItem } from "@/lib/crm/client";
import { cn } from "@/lib/utils";

export function LeadList({
  items,
  selectedId,
  onSelect,
}: {
  items: LeadListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-faint">Aucun lead à ce stade.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((lead) => (
        <li key={lead.id}>
          <button
            onClick={() => onSelect(lead.id)}
            aria-current={lead.id === selectedId ? "true" : undefined}
            className={cn(
              "flex w-full items-start justify-between gap-3 px-2 py-3 text-left transition-colors",
              lead.id === selectedId ? "bg-accent/10" : "hover:bg-paper"
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{lead.contact.name}</span>
              <span className="block truncate font-mono text-xs text-ink-soft">{lead.contact.email}</span>
              <span className="mt-1 block font-mono text-[0.6rem] text-ink-faint">
                {lead.source ?? "—"} · {formatDate(lead.createdAt)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className={cn("border px-1.5 py-0.5 font-mono text-[0.6rem]", LEAD_STAGES[lead.status].tone)}>
                {LEAD_STAGES[lead.status].label}
              </span>
              <span className="font-mono text-[0.65rem] text-ink-soft">{formatEuros(lead.value)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
