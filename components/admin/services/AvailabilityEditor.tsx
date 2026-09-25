"use client";

import { useState } from "react";
import { Btn, inputBase } from "@/components/admin/ui";
import { fieldErrors } from "@/lib/admin/client";
import { replaceAvailability, WEEKDAYS, type ServiceRow } from "@/lib/admin/services";
import { availabilityReplaceSchema, type AvailabilitySlot } from "@/lib/schemas/services";

const sortSlots = (slots: AvailabilitySlot[]) =>
  [...slots].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));

/** Plages horaires hebdomadaires (heure de Paris) d'un service existant. */
export function AvailabilityEditor({ service, onSaved }: { service: ServiceRow; onSaved: () => void }) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>(() =>
    sortSlots(service.availability.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const update = (i: number, patch: Partial<AvailabilitySlot>) => {
    setSlots((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setStatus("idle");
  };
  const add = () => setSlots((list) => [...list, { weekday: 1, startTime: "09:00", endTime: "17:00" }]);
  const remove = (i: number) => setSlots((list) => list.filter((_, j) => j !== i));

  const save = async () => {
    const parsed = availabilityReplaceSchema.safeParse({ slots });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setStatus("saving");
    const res = await replaceAvailability(service.id, parsed.data.slots);
    if (!res.ok) {
      setStatus("idle");
      return setErrors({ _: res.error });
    }
    setSlots(sortSlots(parsed.data.slots));
    setStatus("saved");
    onSaved();
  };

  return (
    <div className="space-y-3">
      {slots.length === 0 ? <p className="text-sm text-ink-faint">Aucune plage : ce service n'est pas réservable.</p> : null}
      {slots.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select aria-label="Jour" className={`${inputBase} w-36`} value={s.weekday} onChange={(e) => update(i, { weekday: Number(e.target.value) })}>
            {WEEKDAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
          </select>
          <input aria-label="Début" type="time" className={`${inputBase} w-28`} value={s.startTime} onChange={(e) => update(i, { startTime: e.target.value })} />
          <span className="font-mono text-xs text-ink-soft">→</span>
          <input aria-label="Fin" type="time" className={`${inputBase} w-28`} value={s.endTime} onChange={(e) => update(i, { endTime: e.target.value })} />
          <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => remove(i)}>Retirer</Btn>
          {errors[`slots.${i}`] ?? errors[`slots.${i}.startTime`] ?? errors[`slots.${i}.endTime`] ? (
            <span className="font-mono text-xs text-accent-ink">{errors[`slots.${i}`] ?? errors[`slots.${i}.startTime`] ?? errors[`slots.${i}.endTime`]}</span>
          ) : null}
        </div>
      ))}
      {errors._ || errors.slots ? <p className="font-mono text-xs text-accent-ink" role="alert">{errors._ ?? errors.slots}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="outline" onClick={add}>+ Plage</Btn>
        <Btn variant="accent" onClick={save} disabled={status === "saving"}>{status === "saving" ? "Enregistrement…" : "Enregistrer le planning"}</Btn>
        {status === "saved" ? <span className="font-mono text-xs text-ink-soft" role="status">Planning enregistré.</span> : null}
      </div>
    </div>
  );
}
