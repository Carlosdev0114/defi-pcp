"use client";

import { useState } from "react";
import { Btn, Field, PageTitle, Panel, inputBase } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { useRemote } from "@/lib/hooks/use-remote";
import { fieldErrors, getConfig, putConfig } from "@/lib/admin/client";
import { profileSchema, type Profile } from "@/lib/schemas/site";
import { FieldError } from "./ContentBits";

const FIELDS: { key: Exclude<keyof Profile, "socials">; label: string; long?: boolean; hint?: string }[] = [
  { key: "name", label: "Nom complet" },
  { key: "role", label: "Titre / rôle" },
  { key: "baseline", label: "Accroche (accueil)", long: true, hint: "La phrase courte sous le titre de l'accueil." },
  { key: "shortBio", label: "Bio courte", long: true, hint: "Accueil, page À propos et chatbot." },
  { key: "email", label: "E-mail public" },
  { key: "phone", label: "Téléphone" },
  { key: "location", label: "Localisation" },
];

function ProfileForm({ initial }: { initial: Profile }) {
  const [v, setV] = useState<Profile>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setState("saving");
    const res = await putConfig<{ profile: Profile }>("profile", parsed.data);
    if (!res.ok) {
      setErrors({ _: res.error });
      return setState("idle");
    }
    setState("saved");
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <Panel title="Identité, présentation et coordonnées">
        <div className="grid gap-5 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint} className={f.long ? "sm:col-span-2" : undefined}>
              {f.long ? (
                <textarea rows={3} className={inputBase} value={v[f.key]} onChange={(e) => setV((x) => ({ ...x, [f.key]: e.target.value }))} />
              ) : (
                <input className={inputBase} value={v[f.key]} onChange={(e) => setV((x) => ({ ...x, [f.key]: e.target.value }))} />
              )}
              <FieldError message={errors[f.key]} />
            </Field>
          ))}
          {(["github", "linkedin", "mastodon"] as const).map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
              <input className={inputBase} value={v.socials[k]} onChange={(e) => setV((x) => ({ ...x, socials: { ...x.socials, [k]: e.target.value } }))} />
              <FieldError message={errors[`socials.${k}`]} />
            </Field>
          ))}
        </div>
      </Panel>
      {errors._ ? <p className="font-mono text-xs text-accent-ink" role="alert">{errors._}</p> : null}
      <Btn type="submit" variant="accent" disabled={state === "saving"}>
        {state === "saving" ? "Enregistrement…" : state === "saved" ? "Enregistré ✓ (site mis à jour)" : "Enregistrer"}
      </Btn>
    </form>
  );
}

/** Profil public (Redis) : affiché sur tout le site et utilisé par le chatbot. */
export function ProfileEditor() {
  const { result } = useRemote("profile", () => getConfig<{ profile: Profile }>("profile"));
  return (
    <>
      <PageTitle eyebrow="Contenu · Profil" title="Profil public" description="Nom et coordonnées affichés sur tout le site (en-tête, pied de page, À propos, Contact) et connus du chatbot." />
      {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/profil" /> : null}
      {result?.ok ? <ProfileForm initial={result.data.profile} /> : result ? null : <p className="font-mono text-xs text-ink-faint">Chargement…</p>}
    </>
  );
}
