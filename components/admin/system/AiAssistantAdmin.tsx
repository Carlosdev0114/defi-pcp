"use client";

import { useState } from "react";
import Link from "next/link";
import { Btn, Field, PageTitle, Panel, Tag, inputBase } from "@/components/admin/ui";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";
import { useRemote } from "@/lib/hooks/use-remote";
import { requestJson } from "@/lib/http/client";
import { fieldErrors, getConfig, putConfig } from "@/lib/admin/client";
import { assistantSchema, type AssistantConfig } from "@/lib/schemas/site";
import { formatParis } from "@/lib/time/paris";

type Status = {
  configured: boolean;
  enabled: boolean;
  index: { buildId: string; builtAt: string; count: number; stale: boolean } | null;
  config: AssistantConfig;
  rebuildCooldownSeconds: number;
};

function ConfigForm({ initial }: { initial: AssistantConfig }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = assistantSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const res = await putConfig("assistant", parsed.data);
    setErrors(res.ok ? {} : { _: res.error });
    setSaved(res.ok);
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <Field label={`Température — ${v.temperature.toFixed(1)}`} hint="Plus bas = plus factuel.">
        <input type="range" min={0} max={1} step={0.1} value={v.temperature} onChange={(e) => { setV({ ...v, temperature: Number(e.target.value) }); setSaved(false); }} className="w-full accent-accent" />
      </Field>
      <Field label={`Extraits par question — ${v.maxChunks}`}>
        <input type="range" min={1} max={8} value={v.maxChunks} onChange={(e) => { setV({ ...v, maxChunks: Number(e.target.value) }); setSaved(false); }} className="w-full accent-accent" />
      </Field>
      <Field label="Consignes de style (facultatif)" hint="Ajoutées APRÈS les règles verrouillées (données publiques uniquement, anti-injection, réponse par défaut) : elles ne peuvent pas les lever.">
        <textarea rows={4} maxLength={1000} className={inputBase} value={v.extraInstructions} onChange={(e) => { setV({ ...v, extraInstructions: e.target.value }); setSaved(false); }} />
        {errors.extraInstructions ? <span className="font-mono text-xs text-accent-ink">{errors.extraInstructions}</span> : null}
      </Field>
      {errors._ ? <p className="font-mono text-xs text-accent-ink" role="alert">{errors._}</p> : null}
      <Btn type="submit" variant="accent">{saved ? "Enregistré ✓" : "Enregistrer les réglages"}</Btn>
    </form>
  );
}

/** Assistant IA : réglages en base (Redis), index RAG réel, test réel sur Gemini. */
export function AiAssistantAdmin() {
  const [version, setVersion] = useState(0);
  const { result } = useRemote(`assistant:${version}`, () => getConfig<Status>("assistant"));
  const [question, setQuestion] = useState("Quelles technologies utilises-tu au quotidien ?");
  const [test, setTest] = useState<{ answer?: string; sources?: string[]; error?: string } | null>(null);
  const [busy, setBusy] = useState<"test" | "rebuild" | null>(null);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);
  const s = result?.ok ? result.data : null;

  const runTest = async () => {
    setBusy("test");
    const res = await requestJson<{ answer: string; sources: string[] }>("/api/admin/assistant/test", { method: "POST", body: JSON.stringify({ question }) });
    setBusy(null);
    setTest(res.ok ? res.data : { error: res.error + (res.retryAfter ? ` (réessayez dans ${res.retryAfter} s)` : "") });
  };
  const rebuild = async () => {
    setBusy("rebuild");
    const res = await requestJson<unknown>("/api/admin/assistant", { method: "POST" });
    setBusy(null);
    setRebuildMsg(res.ok ? "Index reconstruit." : res.error);
    setVersion((n) => n + 1);
  };

  return (
    <>
      <PageTitle
        eyebrow="Système · Assistant IA"
        title="Assistant IA (RAG)"
        description="Répond sur le site à partir du profil et du contenu PUBLIÉ uniquement. La clé Gemini ne quitte jamais le serveur."
        actions={s ? <Tag tone={s.enabled ? "ok" : "neutral"}>{s.enabled ? "Activé" : "Désactivé"}</Tag> : undefined}
      />
      {result && !result.ok ? <ApiErrorNotice status={result.status} error={result.error} returnTo="/admin/assistant-ia" /> : null}
      {s ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Panel title="Réglages"><ConfigForm initial={s.config} /></Panel>
            <Panel title="Test réel">
              <textarea rows={2} maxLength={500} className={inputBase} value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Question de test" />
              <Btn variant="outline" className="mt-2" onClick={runTest} disabled={busy !== null || !s.configured || !question.trim()}>{busy === "test" ? "Question envoyée…" : "Poser la question"}</Btn>
              {test?.answer ? (
                <div className="mt-3 border border-line-strong bg-paper p-3 text-sm">
                  <p className="whitespace-pre-wrap">{test.answer}</p>
                  {test.sources?.length ? <p className="mt-2 font-mono text-[0.65rem] text-ink-faint">Sources : {test.sources.join(" · ")}</p> : null}
                </div>
              ) : null}
              {test?.error ? <p className="mt-3 font-mono text-xs text-accent-ink" role="alert">{test.error}</p> : null}
            </Panel>
          </div>
          <div className="space-y-6">
            <Panel title="Base de connaissances">
              {!s.configured ? <p className="font-mono text-xs text-accent-ink">GEMINI_API_KEY absente du serveur.</p> : null}
              <ul className="space-y-1.5 text-sm">
                <li>Dernière construction : {s.index ? formatParis(s.index.builtAt) : "jamais"}</li>
                <li>Extraits indexés : {s.index?.count ?? 0}</li>
                <li>État : {s.index?.stale ? "périmé (contenu modifié) — reconstruit à la prochaine question" : "à jour"}</li>
              </ul>
              <Btn variant="accent" className="mt-4" onClick={rebuild} disabled={busy !== null || !s.configured || s.rebuildCooldownSeconds > 0}>
                {busy === "rebuild" ? "Reconstruction…" : s.rebuildCooldownSeconds > 0 ? `Possible dans ${Math.ceil(s.rebuildCooldownSeconds / 60)} min` : "Reconstruire maintenant"}
              </Btn>
              {rebuildMsg ? <p className="mt-2 font-mono text-xs text-ink-soft" role="status">{rebuildMsg}</p> : null}
              <p className="mt-3 font-mono text-[0.65rem] text-ink-faint">
                Une reconstruction à la fois, au plus une toutes les 10 min (quota Gemini). Pendant ce temps, l'index précédent continue de répondre.
              </p>
            </Panel>
            <p className="text-sm text-ink-soft">
              Activer ou désactiver l'assistant sur le site : <Link href="/admin/parametres" className="text-accent underline">Paramètres</Link>.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
