"use client";

import { useState } from "react";
import { Btn, Field, inputBase } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { createBlock } from "@/lib/booking/client";
import { localDate } from "@/lib/time/paris";

/** Bloque une plage (vacances, réunion…) : saisie en heure de Paris, convertie
 * en UTC pour l'API ; les visiteurs ne voient plus ces créneaux. */
export function BlockSlotForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState(() => ({ title: "Indisponible", date: localDate(new Date()), start: "14:00", end: "16:00" }));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ status: number; error: string } | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.end <= form.start) {
      setFailure({ status: 400, error: "L'heure de fin doit suivre l'heure de début." });
      return;
    }
    setSaving(true);
    setFailure(null);
    const result = await createBlock(form);
    setSaving(false);
    if (result.ok) onCreated();
    else setFailure({ status: result.status, error: result.error });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Motif">
        <input className={inputBase} value={form.title} onChange={set("title")} maxLength={160} required />
      </Field>
      <Field label="Jour">
        <input type="date" className={inputBase} value={form.date} onChange={set("date")} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="De (Paris)">
          <input type="time" className={inputBase} value={form.start} onChange={set("start")} required />
        </Field>
        <Field label="À (Paris)">
          <input type="time" className={inputBase} value={form.end} onChange={set("end")} required />
        </Field>
      </div>
      <Btn type="submit" variant="accent" className="w-full" disabled={saving}>
        {saving ? "Blocage…" : "+ Bloquer ce créneau"}
      </Btn>
      {failure ? <ApiErrorNotice {...failure} returnTo="/admin/agenda" /> : null}
    </form>
  );
}
