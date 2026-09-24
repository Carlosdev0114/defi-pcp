"use client";

import { Panel, Tag } from "@/components/admin/ui";
import { LEAD_STAGES } from "@/lib/crm/stages";
import { fetchLead, formatDate, formatEuros } from "@/lib/crm/client";
import { useRemote } from "@/lib/hooks/use-remote";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { LeadStatusControl } from "./LeadStatusControl";
import { LeadHistory } from "./LeadHistory";
import { LeadNotes } from "./LeadNotes";

/** Fiche d'un lead : contact, statut, historique, notes. */
export function LeadDetailPanel({
  leadId,
  version,
  onChanged,
}: {
  leadId: string | null;
  /** Incrémenté après chaque modification, pour recharger la fiche. */
  version: number;
  onChanged: () => void;
}) {
  const { result, loading } = useRemote(leadId ? `${leadId}:${version}` : null, () => fetchLead(leadId!));

  if (!leadId) {
    return (
      <Panel title="Détail du lead">
        <p className="text-sm text-ink-faint">Sélectionnez un lead pour voir sa fiche et le déplacer dans le pipeline.</p>
      </Panel>
    );
  }
  if (loading || !result) {
    return (
      <Panel title="Détail du lead">
        <p className="font-mono text-xs text-ink-faint" role="status">Chargement…</p>
      </Panel>
    );
  }
  if (!result.ok) {
    return (
      <Panel title="Détail du lead">
        <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/leads" />
      </Panel>
    );
  }

  const lead = result.data;
  return (
    <Panel title={`Lead — ${lead.contact.name}`} aside={<Tag tone="accent">{LEAD_STAGES[lead.status].label}</Tag>}>
      <div className="space-y-5">
        <div>
          <p className="font-mono text-xs text-ink-soft">{lead.contact.email}</p>
          <p className="mt-1 font-mono text-[0.65rem] text-ink-faint">
            {lead.source ?? "—"} · reçu le {formatDate(lead.contact.createdAt)} · {formatEuros(lead.value)}
          </p>
          {/* Message du visiteur : texte brut, échappé par React. */}
          <p className="mt-3 whitespace-pre-wrap break-words border-l-2 border-line pl-3 text-sm leading-relaxed text-ink-soft">
            {lead.contact.message}
          </p>
        </div>
        <LeadStatusControl leadId={lead.id} current={lead.status} onChanged={onChanged} />
        <LeadHistory events={lead.events} />
        <LeadNotes leadId={lead.id} notes={lead.notes} onAdded={onChanged} />
      </div>
    </Panel>
  );
}
