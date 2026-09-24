"use client";

import type { ContactValues, FieldErrors } from "@/lib/contact/client";
import { CONTACT_LIMITS } from "@/lib/schemas/contact";
import { cn } from "@/lib/utils";

const inputClass =
  "mt-2 w-full border-2 bg-cream px-4 py-3 text-base outline-none transition-colors placeholder:text-ink-faint focus:border-accent";

type Props = {
  values: ContactValues;
  errors: FieldErrors;
  onChange: (field: keyof ContactValues, value: string) => void;
  disabled: boolean;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span id={id} className="mt-1.5 block font-mono text-xs text-accent-ink">
      {message}
    </span>
  ) : null;
}

export function ContactFields({ values, errors, onChange, disabled }: Props) {
  const field = (name: keyof ContactValues) => ({
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(name, e.target.value),
    disabled,
    "aria-invalid": Boolean(errors[name as keyof FieldErrors]) || undefined,
    "aria-describedby": errors[name as keyof FieldErrors] ? `contact-${name}-error` : undefined,
    className: cn(inputClass, errors[name as keyof FieldErrors] ? "border-accent" : "border-ink"),
  });

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block">
        <span className="label-mono text-ink-soft">Nom</span>
        <input type="text" autoComplete="name" maxLength={CONTACT_LIMITS.nameMax} placeholder="Camille Dupont" {...field("name")} />
        <FieldError id="contact-name-error" message={errors.name} />
      </label>
      <label className="block">
        <span className="label-mono text-ink-soft">E-mail</span>
        <input type="email" autoComplete="email" maxLength={254} placeholder="vous@exemple.fr" {...field("email")} />
        <FieldError id="contact-email-error" message={errors.email} />
      </label>
      <label className="block sm:col-span-2">
        <span className="label-mono text-ink-soft">Sujet</span>
        <input type="text" maxLength={CONTACT_LIMITS.subjectMax} placeholder="Une mission, une question, un café" {...field("subject")} />
        <FieldError id="contact-subject-error" message={errors.subject} />
      </label>
      <label className="block sm:col-span-2">
        <span className="label-mono text-ink-soft">Message</span>
        <textarea
          rows={6}
          maxLength={CONTACT_LIMITS.messageMax}
          placeholder="Parlez-moi du contexte, de l'échéance, et du résultat que vous visez."
          {...field("message")}
          className={cn(field("message").className, "resize-y")}
        />
        <FieldError id="contact-message-error" message={errors.message} />
      </label>

      {/* Pot de miel : hors écran, ignoré des lecteurs d'écran et du clavier.
          Un humain le laisse vide ; un bot qui remplit tout est ignoré. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Ne pas remplir
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => onChange("website", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
