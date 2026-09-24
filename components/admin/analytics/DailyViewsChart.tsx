import { Panel } from "@/components/admin/ui";
import { formatDay } from "@/lib/time/paris";

/** Pages vues par jour (30 jours, heure de Paris). */
export function DailyViewsChart({ days }: { days: { date: string; views: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.views));
  return (
    <Panel title="Pages vues par jour">
      <div className="flex h-52 items-end gap-1" role="img" aria-label={`Pages vues sur ${days.length} jours`}>
        {days.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${formatDay(d.date)} : ${d.views}`}>
            <div className="w-full bg-accent transition-colors group-hover:bg-accent-strong" style={{ height: `${d.views ? Math.max(2, (d.views / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-line pt-2 font-mono text-[0.6rem] text-ink-faint" aria-hidden="true">
        <span>{formatDay(days[0]?.date ?? "")}</span>
        <span>{formatDay(days[days.length - 1]?.date ?? "")}</span>
      </div>
    </Panel>
  );
}
