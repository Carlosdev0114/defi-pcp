"use client";

import { BOOKING_LIMITS } from "@/lib/schemas/booking";
import { cn } from "@/lib/utils";

export type VisitorValues = { visitorName: string; visitorEmail: string; notes: string };
export type VisitorErrors = Partial<Record<keyof VisitorValues, string>>;

const inputClass = "mt-2 w-full border-2 bg-cream px-4 py-3 outline-none transition-colors placeholder:text-ink-faint focus:border-accent";

/** Étape 3 : coordonnées du visiteur (validées avec le schéma partagé). */
export function ContactStep({
  values,
  errors,
  onChange,
}: {
  values: VisitorValues;
  errors: VisitorErrors;
  onChange: (field: keyof VisitorValues, value: string) => void;
}) {
  const props = (field: keyof VisitorValues) => ({
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(field, e.target.value),
    "aria-invalid": Boolean(errors[field]) || undefined,
    "aria-describedby": errors[field] ? `booking-${field}-error` : undefined,
    className: cn(inputClass, errors[field] ? "border-accent" : "border-ink"),
  });
  const error = (field: keyof VisitorValues) =>
    errors[field] ? (
      <span id={`booking-${field}-error`} className="mt-1.5 block font-mono text-xs text-accent-ink">
        {errors[field]}
      </span>
    ) : null;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block">
        <span className="label-mono text-ink-soft">Votre nom</span>
        <input type="text" autoComplete="name" maxLength={BOOKING_LIMITS.nameMax} placeholder="Camille Dupont" {...props("visitorName")} />
        {error("visitorName")}
      </label>
      <label className="block">
        <span className="label-mono text-ink-soft">Votre e-mail</span>
        <input type="email" autoComplete="email" maxLength={254} placeholder="vous@exemple.fr" {...props("visitorEmail")} />
        {error("visitorEmail")}
      </label>
      <label className="block sm:col-span-2">
        <span className="label-mono text-ink-soft">Un mot sur le sujet (optionnel)</span>
        <textarea
          rows={4}
          maxLength={BOOKING_LIMITS.notesMax}
          placeholder="Le contexte qui éclairera le rendez-vous."
          {...props("notes")}
          className={cn(props("notes").className, "resize-y")}
        />
        {error("notes")}
      </label>
    </div>
  );
}
