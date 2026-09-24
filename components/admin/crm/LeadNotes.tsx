"use client";

import { useState } from "react";
import { Btn, inputBase } from "@/components/admin/ui";
import { addLeadNote, formatDate, type LeadDetail } from "@/lib/crm/client";
import { ApiErrorNotice } from "@/components/admin/common/ApiErrorNotice";

/** Notes internes du lead (LeadNote). Rendues comme texte, jamais en HTML. */
export function LeadNotes({
  leadId,
  notes,
  onAdded,
}: {
  leadId: string;
  notes: LeadDetail["notes"];
  onAdded: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ status: number; error: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    setFailure(null);
    const result = await addLeadNote(leadId, content);
    setSaving(false);
    if (result.ok) {
      setDraft("");
      onAdded();
    } else setFailure({ status: result.status, error: result.error });
  };

  return (
    <div>
      <p className="label-mono mb-2 text-ink-faint">Notes</p>
      {notes.length === 0 ? <p className="text-xs text-ink-faint">Aucune note.</p> : null}
      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="border border-line bg-paper p-2.5 text-sm">
            <p className="whitespace-pre-wrap break-words">{n.content}</p>
            <p className="mt-1 font-mono text-[0.6rem] text-ink-faint">{formatDate(n.createdAt)}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <textarea
          rows={2}
          maxLength={5000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ajouter une note…"
          aria-label="Nouvelle note"
          className={inputBase}
        />
        <Btn type="submit" variant="primary" className="px-3 py-1.5 text-xs" disabled={saving || !draft.trim()}>
          {saving ? "Enregistrement…" : "Ajouter la note"}
        </Btn>
      </form>
      {failure ? <div className="mt-2"><ApiErrorNotice {...failure} returnTo="/admin/leads" /></div> : null}
    </div>
  );
}
