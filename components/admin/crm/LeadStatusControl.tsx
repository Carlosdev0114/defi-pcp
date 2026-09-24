"use client";

import { useState } from "react";
import { Btn } from "@/components/admin/ui";
import { LEAD_STAGES, LEAD_STATUSES, type LeadStatus } from "@/lib/crm/stages";
import { updateLeadStatus } from "@/lib/crm/client";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";

/** Déplacement dans le pipeline : PATCH /api/admin/leads/[id] (le serveur
 * enregistre l'événement from → to dans la même transaction). */
export function LeadStatusControl({
  leadId,
  current,
  onChanged,
}: {
  leadId: string;
  current: LeadStatus;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState<LeadStatus | null>(null);
  const [failure, setFailure] = useState<{ status: number; error: string } | null>(null);

  const move = async (status: LeadStatus) => {
    setSaving(status);
    setFailure(null);
    const result = await updateLeadStatus(leadId, status);
    setSaving(null);
    if (result.ok) onChanged();
    else setFailure({ status: result.status, error: result.error });
  };

  return (
    <div>
      <p className="label-mono mb-2 text-ink-faint">Déplacer vers</p>
      <div className="flex flex-wrap gap-2">
        {LEAD_STATUSES.filter((s) => s !== current).map((s) => (
          <Btn key={s} variant="outline" className="px-3 py-1.5 text-xs" disabled={saving !== null} onClick={() => move(s)}>
            {saving === s ? "…" : LEAD_STAGES[s].label}
          </Btn>
        ))}
      </div>
      {failure ? <div className="mt-2"><ApiErrorNotice {...failure} returnTo="/admin/leads" /></div> : null}
    </div>
  );
}
