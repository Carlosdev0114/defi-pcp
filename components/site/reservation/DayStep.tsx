import type { DayAvailability } from "@/lib/booking/client";
import { formatDay } from "@/lib/time/paris";
import { cn } from "@/lib/utils";

/** Étape 2a : les 14 prochains jours, avec le nombre de créneaux libres. */
export function DayStep({
  days,
  selected,
  onPick,
}: {
  days: DayAvailability[];
  selected: string | null;
  onPick: (date: string) => void;
}) {
  const open = days.filter((d) => d.count > 0);
  return (
    <fieldset>
      <legend className="label-mono text-ink-soft">Choisissez un jour (heure de Paris)</legend>
      {open.length === 0 ? (
        <p className="mt-3 font-mono text-sm text-ink-faint">Aucun créneau libre sur les 14 prochains jours.</p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {days.map((d) => (
          <button
            key={d.date}
            onClick={() => onPick(d.date)}
            disabled={d.count === 0}
            aria-pressed={selected === d.date}
            className={cn(
              "border-2 px-3 py-2.5 text-center font-mono text-xs transition-colors",
              d.count === 0 && "cursor-not-allowed border-line bg-paper text-ink-faint",
              d.count > 0 && selected !== d.date && "border-ink bg-cream hover:border-accent",
              selected === d.date && "border-accent bg-accent/10"
            )}
          >
            <span className="block">{formatDay(d.date)}</span>
            <span className="block text-[0.6rem] text-ink-faint">
              {d.count === 0 ? "complet" : `${d.count} créneau${d.count > 1 ? "x" : ""}`}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
