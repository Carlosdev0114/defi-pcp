"use client";

import { useState } from "react";
import { Btn, Panel, Tag } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { APPOINTMENT_ACTIONS, APPOINTMENT_STAGES, APPOINTMENT_TRANSITIONS, type AppointmentStatus } from "@/lib/booking/status";
import { setAppointmentStatus, type AdminAppointment } from "@/lib/booking/client";
import { formatParis } from "@/lib/time/paris";

/** Fiche d'un RDV : seules les actions autorisées depuis son statut sont proposées. */
export function AppointmentDetail({
  appointment,
  onChanged,
}: {
  appointment: AdminAppointment | null;
  onChanged: (updated: AdminAppointment) => void;
}) {
  const [saving, setSaving] = useState<AppointmentStatus | null>(null);
  const [failure, setFailure] = useState<{ status: number; error: string } | null>(null);

  if (!appointment) {
    return (
      <Panel title="Rendez-vous">
        <p className="text-sm text-ink-faint">Sélectionnez un rendez-vous pour l'accepter, le refuser ou l'annuler.</p>
      </Panel>
    );
  }

  const act = async (status: AppointmentStatus) => {
    setSaving(status);
    setFailure(null);
    const result = await setAppointmentStatus(appointment.id, status);
    setSaving(null);
    if (result.ok) onChanged({ ...appointment, status });
    else setFailure({ status: result.status, error: result.error });
  };

  const actions = APPOINTMENT_TRANSITIONS[appointment.status];
  return (
    <Panel title={appointment.reference} aside={<Tag tone="accent">{APPOINTMENT_STAGES[appointment.status].label}</Tag>}>
      <div className="space-y-4">
        <div>
          <p className="font-display text-xl">{appointment.service.name}</p>
          <p className="mt-1 font-mono text-sm text-accent">
            {formatParis(appointment.startAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            {" – "}
            {formatParis(appointment.endAt, { hour: "2-digit", minute: "2-digit" })} (Paris)
          </p>
        </div>
        <div className="text-sm">
          <p className="font-medium">{appointment.visitorName}</p>
          <p className="font-mono text-xs text-ink-soft">{appointment.visitorEmail}</p>
          {appointment.notes ? (
            <p className="mt-2 whitespace-pre-wrap break-words border-l-2 border-line pl-3 text-ink-soft">{appointment.notes}</p>
          ) : null}
        </div>
        {actions.length ? (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {actions.map((status) => (
              <Btn
                key={status}
                variant={status === "CONFIRMED" || status === "COMPLETED" ? "accent" : "danger"}
                className="px-3 py-1.5 text-xs"
                disabled={saving !== null}
                onClick={() => act(status)}
              >
                {saving === status ? "…" : APPOINTMENT_ACTIONS[status]}
              </Btn>
            ))}
          </div>
        ) : (
          <p className="border-t border-line pt-3 font-mono text-xs text-ink-faint">Rendez-vous clos : plus aucune action possible.</p>
        )}
        {failure ? <ApiErrorNotice {...failure} returnTo="/admin/agenda" /> : null}
      </div>
    </Panel>
  );
}
