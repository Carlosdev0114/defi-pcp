"use client";

import { useState } from "react";
import { Btn, PageTitle, Panel, Tag } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { Pagination } from "@/components/admin/common/Pagination";
import { DeleteButton } from "@/components/admin/content/ContentBits";
import { useRemote } from "@/lib/hooks/use-remote";
import { createItem, deleteItem, fetchPage, updateItem } from "@/lib/admin/client";
import type { ServiceRow } from "@/lib/admin/services";
import { ServiceForm } from "./ServiceForm";
import { AvailabilityEditor } from "./AvailabilityEditor";

/** Services réservables : liste paginée côté serveur, formulaire et planning hebdomadaire. */
export function ServicesManager() {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { result } = useRemote(`services:${page}:${version}`, () => fetchPage<ServiceRow>("services", page));
  const refresh = () => setVersion((n) => n + 1);
  const data = result?.ok ? result.data : null;

  const save = async (body: unknown) => {
    const res = editing === "new" ? await createItem<ServiceRow>("services", body) : await updateItem<ServiceRow>("services", (editing as ServiceRow).id, body);
    if (!res.ok) return res.error;
    // Après création, on reste sur le service pour définir son planning.
    setEditing(editing === "new" ? { ...res.data, availability: [] } : null);
    refresh();
    return null;
  };

  const remove = async (service: ServiceRow) => {
    const res = await deleteItem("services", service.id);
    setNotice(res.ok ? null : res.error);
    if (res.ok) refresh();
  };

  return (
    <>
      <PageTitle eyebrow="Client · Services" title="Services" description="Les prestations proposées sur /reservation, avec leurs plages horaires (heure de Paris)." actions={<Btn variant="accent" onClick={() => setEditing("new")}>+ Nouveau service</Btn>} />
      {editing ? (
        <div className="space-y-6">
          <Panel title={editing === "new" ? "Nouveau service" : `Modifier — ${editing.name}`}>
            <ServiceForm key={editing === "new" ? "new" : editing.id} service={editing === "new" ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} />
          </Panel>
          {editing !== "new" ? (
            <Panel title="Planning hebdomadaire">
              <AvailabilityEditor key={editing.id} service={editing} onSaved={refresh} />
            </Panel>
          ) : null}
        </div>
      ) : (
        <>
          {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/services" /> : null}
          {notice ? <p className="mb-3 border-2 border-accent bg-accent/10 p-3 font-mono text-xs text-accent-ink" role="alert">{notice}</p> : null}
          {data ? (
            <div className="space-y-3">
              {data.items.map((s) => (
                <div key={s.id} className="flex flex-col justify-between gap-3 border-2 border-ink bg-cream p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-display text-xl">{s.name}</p>
                    <p className="font-mono text-xs text-ink-soft">
                      {s.durationMin} min · {s.availability.length} plage{s.availability.length > 1 ? "s" : ""} par semaine
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag tone={s.active ? "ok" : "neutral"}>{s.active ? "Actif" : "Inactif"}</Tag>
                    <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(s)}>Éditer</Btn>
                    <DeleteButton onConfirm={() => remove(s)} />
                  </div>
                </div>
              ))}
              {data.items.length === 0 ? <p className="text-sm text-ink-faint">Aucun service : la réservation n'affiche rien tant qu'il n'y en a pas.</p> : null}
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} noun={["service", "services"]} />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
