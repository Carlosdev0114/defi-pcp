import { cn } from "@/lib/utils";

const STEPS = ["01 Service", "02 Date", "03 Coordonnées"];

export function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2 border-2 border-ink bg-cream p-3" aria-label="Étapes de la réservation">
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === step ? "step" : undefined}
          className={cn(
            "px-3 py-2 text-center font-mono text-xs",
            i < step ? "bg-ink text-cream" : i === step ? "bg-accent text-cream" : "text-ink-faint"
          )}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}
