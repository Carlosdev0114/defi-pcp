import { stageLabel } from "@/lib/crm/stages";
import { formatDate, type LeadDetail } from "@/lib/crm/client";

/** Trajectoire du lead (LeadEvent), du plus récent au plus ancien. */
export function LeadHistory({ events }: { events: LeadDetail["events"] }) {
  return (
    <div>
      <p className="label-mono mb-2 text-ink-faint">Historique</p>
      <ol className="space-y-1.5 border-l-2 border-line pl-3">
        {events.map((e) => (
          <li key={e.id} className="font-mono text-xs">
            <span className="text-ink-soft">{e.fromStatus ? stageLabel(e.fromStatus) : "Création"}</span>
            {" → "}
            <span className="font-semibold">{stageLabel(e.toStatus)}</span>
            <span className="block text-[0.6rem] text-ink-faint">{formatDate(e.createdAt)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
