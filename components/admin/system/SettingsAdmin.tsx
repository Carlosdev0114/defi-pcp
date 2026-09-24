"use client";

import { useState } from "react";
import { Btn, Field, PageTitle, Panel, inputBase } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { useRemote } from "@/lib/hooks/use-remote";
import { fieldErrors, getConfig, putConfig } from "@/lib/admin/client";
import { modulesSchema, settingsSchema, type Modules, type Settings } from "@/lib/schemas/site";

type Data = { settings: Settings; modules: Modules };

function SettingsForm({ initial }: { initial: Data }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = settingsSchema.safeParse(v.settings);
    const m = modulesSchema.safeParse(v.modules);
    if (!s.success) return setErrors(fieldErrors(s.error));
    if (!m.success) return setErrors(fieldErrors(m.error));
    const res = await putConfig<Data>("settings", { settings: s.data, modules: m.data });
    setErrors(res.ok ? {} : { _: res.error });
    setSaved(res.ok);
  };

  const modules: { key: keyof Modules; label: string; desc: string }[] = [
    { key: "booking", label: "Réservation en ligne", desc: "Page /reservation et API de réservation (fermées si désactivé)." },
    { key: "chat", label: "Assistant IA", desc: "Widget du chatbot sur le site et /api/chat (désactivés si coupé)." },
  ];

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-2">
      <Panel title="Général">
        <Field label="Nom du site (back-office)">
          <input className={inputBase} value={v.settings.siteName} maxLength={120} onChange={(e) => { setV({ ...v, settings: { siteName: e.target.value } }); setSaved(false); }} />
          {errors.siteName ? <span className="font-mono text-xs text-accent-ink">{errors.siteName}</span> : null}
        </Field>
      </Panel>
      <Panel title="Modules actifs (appliqués côté serveur)">
        <ul className="space-y-3">
          {modules.map((m) => (
            <li key={m.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-ink-faint">{m.desc}</p>
              </div>
              <input type="checkbox" aria-label={m.label} className="h-5 w-5 accent-accent" checked={v.modules[m.key]}
                onChange={(e) => { setV({ ...v, modules: { ...v.modules, [m.key]: e.target.checked } }); setSaved(false); }} />
            </li>
          ))}
        </ul>
      </Panel>
      <div className="lg:col-span-2">
        {errors._ ? <p className="mb-2 font-mono text-xs text-accent-ink" role="alert">{errors._}</p> : null}
        <Btn type="submit" variant="accent">{saved ? "Enregistré ✓ (site mis à jour)" : "Enregistrer"}</Btn>
      </div>
    </form>
  );
}

/** Paramètres : lus et écrits en base (Redis), modules appliqués côté serveur. */
export function SettingsAdmin() {
  const { result } = useRemote("settings", () => getConfig<Data>("settings"));
  return (
    <>
      <PageTitle eyebrow="Système · Paramètres" title="Paramètres" description="Nom du site et modules activables. Chaque interrupteur est appliqué par le serveur, pas seulement masqué." />
      {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/parametres" /> : null}
      {result?.ok ? <SettingsForm initial={result.data} /> : null}
    </>
  );
}
