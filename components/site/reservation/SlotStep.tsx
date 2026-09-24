import type { Slot } from "@/lib/booking/client";
import { formatDay } from "@/lib/time/paris";
import { cn } from "@/lib/utils";

/** Étape 2b : créneaux libres du jour choisi (heures de Paris). */
export function SlotStep({
  date,
  slots,
  loading,
  selected,
  onPick,
}: {
  date: string;
  slots: Slot[];
  loading: boolean;
  selected: Slot | null;
  onPick: (slot: Slot) => void;
}) {
  return (
    <fieldset>
      <legend className="label-mono text-ink-soft">Créneaux le {formatDay(date)}</legend>
      {loading ? <p className="mt-3 font-mono text-xs text-ink-faint" role="status">Chargement des créneaux…</p> : null}
      {!loading && slots.length === 0 ? (
        <p className="mt-3 font-mono text-sm text-ink-faint">Plus aucun créneau libre ce jour-là.</p>
      ) : null}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {slots.map((s) => {
          const active = selected?.startAt === s.startAt;
          return (
            <button
              key={s.startAt}
              onClick={() => onPick(s)}
              aria-pressed={active}
              className={cn(
                "border-2 px-3 py-2.5 font-mono text-sm transition-colors",
                active ? "border-accent bg-accent text-cream" : "border-ink bg-cream hover:border-accent"
              )}
            >
              {s.time}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
