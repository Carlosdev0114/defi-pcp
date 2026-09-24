import type { PublicService } from "@/lib/booking/client";
import { cn } from "@/lib/utils";

/** Étape 1 : choix du service (données réelles ; description en texte). */
export function ServiceStep({
  services,
  selected,
  onPick,
}: {
  services: PublicService[];
  selected: PublicService | null;
  onPick: (s: PublicService) => void;
}) {
  if (services.length === 0) {
    return <p className="text-sm text-ink-faint">Aucun service n'est réservable pour le moment.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {services.map((s) => {
        const active = selected?.id === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            aria-pressed={active}
            className={cn(
              "flex flex-col border-2 p-5 text-left transition-colors",
              active ? "border-accent bg-accent/10" : "border-ink bg-cream hover:border-accent"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-xl leading-tight">{s.name}</p>
              <span
                className={cn("mt-1 h-4 w-4 shrink-0 border-2", active ? "border-accent bg-accent" : "border-ink-soft bg-transparent")}
                aria-hidden="true"
              />
            </div>
            {s.description ? <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{s.description}</p> : null}
            <p className="mt-4 border-t border-line pt-3 font-mono text-xs text-ink-soft">{s.durationMin} min</p>
          </button>
        );
      })}
    </div>
  );
}
