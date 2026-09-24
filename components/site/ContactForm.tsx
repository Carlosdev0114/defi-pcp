"use client";

import { useState } from "react";
import { Button } from "@/components/ui/buttons";
import { sendContact, validateContact, type ContactValues, type FieldErrors } from "@/lib/contact/client";
import { ContactFields } from "./contact/ContactFields";
import { ContactSuccess } from "./contact/ContactSuccess";

const EMPTY: ContactValues = { name: "", email: "", subject: "", message: "", website: "" };

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; name: string } | { kind: "error"; message: string };

/** Formulaire de contact : validation locale (même schéma Zod que l'API),
 * puis POST /api/contact, qui crée le contact ET le lead côté serveur. */
export function ContactForm() {
  const [values, setValues] = useState<ContactValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const onChange = (field: keyof ContactValues, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status.kind === "sending") return;

    const checked = validateContact(values);
    if (checked.errors) {
      setErrors(checked.errors);
      setStatus({ kind: "error", message: "Corrigez les champs signalés." });
      return;
    }

    setStatus({ kind: "sending" });
    const outcome = await sendContact(checked.data);
    if (outcome.kind === "sent") {
      setStatus({ kind: "sent", name: checked.data.name });
      setValues(EMPTY);
      return;
    }
    // Le message de l'API (429) indique déjà le délai en secondes.
    setStatus({ kind: "error", message: outcome.error });
  };

  if (status.kind === "sent") {
    return <ContactSuccess name={status.name} onReset={() => setStatus({ kind: "idle" })} />;
  }

  const sending = status.kind === "sending";
  return (
    <form onSubmit={submit} noValidate className="relative">
      <ContactFields values={values} errors={errors} onChange={onChange} disabled={sending} />

      {status.kind === "error" ? (
        <p className="mt-4 font-mono text-sm text-accent-ink" role="alert">
          {status.message}
        </p>
      ) : null}

      <Button type="submit" variant="accent" className="mt-6 w-full sm:w-auto" disabled={sending}>
        {sending ? "Envoi…" : "Envoyer le message"}
      </Button>
    </form>
  );
}
