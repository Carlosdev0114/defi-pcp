"use client";

import { useState } from "react";
import { MESSAGE_MAX, startConversationSchema, type StartConversationInput } from "@/lib/schemas/message";

type Values = { visitorName: string; visitorEmail: string; content: string };

/** Premier message : nom et e-mail facultatifs, validés avec le schéma de l'API. */
export function StartConversationForm({
  onStart,
  disabled,
}: {
  onStart: (input: StartConversationInput) => Promise<void>;
  disabled: boolean;
}) {
  const [values, setValues] = useState<Values>({ visitorName: "", visitorEmail: "", content: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = startConversationSchema.safeParse({
      content: values.content,
      visitorName: values.visitorName.trim() || undefined,
      visitorEmail: values.visitorEmail.trim() || undefined,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    await onStart(parsed.data);
  };

  const input = "w-full border border-line-strong bg-cream px-3 py-2 text-sm placeholder:text-ink-faint";
  const err = (k: keyof Values) => (errors[k] ? <span className="mt-1 block font-mono text-[0.65rem] text-accent-ink">{errors[k]}</span> : null);

  return (
    <form onSubmit={submit} className="space-y-3 p-4 text-sm">
      <p className="leading-relaxed text-ink-soft">Une question avant ou après une réservation ? Écrivez-moi, je réponds ici même.</p>
      <label className="block">
        <span className="label-mono text-ink-faint">Nom (facultatif)</span>
        <input className={input} value={values.visitorName} onChange={set("visitorName")} maxLength={120} autoComplete="name" />
        {err("visitorName")}
      </label>
      <label className="block">
        <span className="label-mono text-ink-faint">E-mail (facultatif)</span>
        <input className={input} type="email" value={values.visitorEmail} onChange={set("visitorEmail")} maxLength={254} autoComplete="email" />
        {err("visitorEmail")}
      </label>
      <label className="block">
        <span className="label-mono text-ink-faint">Message</span>
        <textarea className={`${input} resize-y`} rows={3} value={values.content} onChange={set("content")} maxLength={MESSAGE_MAX} aria-label="Premier message" />
        {err("content")}
      </label>
      <button type="submit" disabled={disabled} className="w-full bg-ink px-4 py-2.5 font-mono text-sm text-cream transition-colors hover:bg-accent disabled:opacity-40">
        Envoyer
      </button>
    </form>
  );
}
