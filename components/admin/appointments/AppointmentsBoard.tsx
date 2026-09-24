"use client";

import { useState } from "react";
import { PageTitle, Panel } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { Pagination } from "@/components/admin/common/Pagination";
import { useRemote } from "@/lib/hooks/use-remote";
import { fetchAppointments, type AdminAppointment } from "@/lib/booking/client";
import type { AppointmentStatus } from "@/lib/booking/status";
import { AppointmentTabs } from "./AppointmentTabs";
import { AppointmentList } from "./AppointmentList";
import { AppointmentDetail } from "./AppointmentDetail";
import { BlocksPanel } from "./BlocksPanel";

/** Agenda : onglets par statut → RDV paginés côté serveur → fiche + actions,
 * et blocage de créneaux. Toutes les heures en Europe/Paris. */
export function AppointmentsBoard() {
  const [status, setStatus] = useState<AppointmentStatus | null>("PENDING");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminAppointment | null>(null);
  const [version, setVersion] = useState(0);

  const { result, loading } = useRemote(`${status ?? "ALL"}:${page}:${version}`, () => fetchAppointments({ status, page }));
  const data = result?.ok ? result.data : null;
  const refresh = () => setVersion((v) => v + 1);

  return (
    <>
      <PageTitle
        eyebrow="Client · Agenda"
        title="Rendez-vous"
        description="Les réservations faites sur le site arrivent « En attente de confirmation ». Toutes les heures sont en heure de Paris."
      />
      <AppointmentTabs active={status} counts={data?.counts ?? null} onSelect={(s) => { setStatus(s); setPage(1); }} />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Rendez-vous">
          {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/agenda" /> : null}
          {loading && !data ? <p className="font-mono text-xs text-ink-faint" role="status">Chargement…</p> : null}
          {data ? (
            <>
              <AppointmentList items={data.items} selectedId={selected?.id ?? null} onSelect={setSelected} />
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} disabled={loading} noun={["rendez-vous", "rendez-vous"]} />
            </>
          ) : null}
        </Panel>

        <div className="space-y-6">
          <AppointmentDetail appointment={selected} onChanged={(updated) => { setSelected(updated); refresh(); }} />
          <BlocksPanel onChanged={refresh} />
        </div>
      </div>
    </>
  );
}
