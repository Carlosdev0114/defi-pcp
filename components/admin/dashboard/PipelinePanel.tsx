import { Panel } from "@/components/admin/ui";
import { LEAD_STAGES } from "@/lib/crm/stages";
import type { PipelineSummary } from "@/lib/server/crm";

export function PipelinePanel({ pipeline }: { pipeline: PipelineSummary }) {
  const maxCount = Math.max(1, ...pipeline.stages.map((s) => s.count));
  return (
    <Panel title="Pipeline — en cours">
      <p className="font-mono text-xs text-ink-soft">
        {pipeline.inProgressValue.toLocaleString("fr-FR")} € de missions en cours de discussion
      </p>
      <div className="mt-3 flex h-24 items-end gap-1" aria-hidden="true">
        {pipeline.stages.map((s) => (
          <div key={s.status} title={`${LEAD_STAGES[s.status].label} : ${s.count}`} className="flex-1 bg-accent" style={{ height: `${Math.max(4, (s.count / maxCount) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-1 flex gap-1 font-mono text-[0.55rem] text-ink-faint" aria-hidden="true">
        {pipeline.stages.map((s) => (
          <span key={s.status} className="flex-1 truncate text-center">{LEAD_STAGES[s.status].label}</span>
        ))}
      </div>
      <div className="mt-3 flex justify-between font-mono text-[0.65rem] text-ink-faint">
        <span>{pipeline.open} lead(s) actif(s)</span>
        <span>{pipeline.won} gagné(s)</span>
      </div>
    </Panel>
  );
}
