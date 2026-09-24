"use client";

import { useState } from "react";
import { PageTitle, Panel } from "@/components/admin/ui";
import type { LeadStatus } from "@/lib/crm/stages";
import { fetchLeads, formatEuros } from "@/lib/crm/client";
import { useRemote } from "@/lib/hooks/use-remote";
import { StatusTabs } from "./StatusTabs";
import { LeadList } from "./LeadList";
import { Pagination } from "@/components/admin/common/Pagination";
import { LeadDetailPanel } from "./LeadDetailPanel";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";

/** CRM : onglets par stade → liste paginée côté serveur → fiche du lead. */
export function LeadsBoard() {
  const [status, setStatus] = useState<LeadStatus | null>(null);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const { result, loading } = useRemote(`${status ?? "ALL"}:${page}:${version}`, () => fetchLeads({ status, page }));
  const data = result?.ok ? result.data : null;

  const selectTab = (next: LeadStatus | null) => {
    setStatus(next);
    setPage(1);
  };
  const refresh = () => setVersion((v) => v + 1);

  return (
    <>
      <PageTitle
        eyebrow="Client · CRM"
        title="Pipeline de leads"
        description={
          data
            ? `${data.pipeline.total} leads, dont ${data.pipeline.open} en cours · ${formatEuros(data.pipeline.inProgressValue)} en discussion. Les messages du formulaire de contact arrivent ici au stade « Nouveau ».`
            : "Chargement du pipeline…"
        }
      />

      <StatusTabs active={status} pipeline={data?.pipeline ?? null} onSelect={selectTab} />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Leads">
          {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/leads" /> : null}
          {loading && !data ? <p className="font-mono text-xs text-ink-faint" role="status">Chargement…</p> : null}
          {data ? (
            <>
              <LeadList items={data.items} selectedId={selectedId} onSelect={setSelectedId} />
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                onPage={setPage}
                disabled={loading}
                noun={["lead", "leads"]}
              />
            </>
          ) : null}
        </Panel>

        <LeadDetailPanel leadId={selectedId} version={version} onChanged={refresh} />
      </div>
    </>
  );
}
