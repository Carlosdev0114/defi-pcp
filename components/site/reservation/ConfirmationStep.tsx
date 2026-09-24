import Link from "next/link";
import type { BookedAppointment } from "@/lib/booking/client";
import { APPOINTMENT_STAGES } from "@/lib/booking/status";
import { formatParis } from "@/lib/time/paris";
import { ArrowUpRightIcon, CheckIcon } from "@/components/ui/icons";

/** Étape 4 : demande enregistrée, avec la vraie référence et le vrai statut. */
export function ConfirmationStep({ appointment, name }: { appointment: BookedAppointment; name: string }) {
  const rows: Array<[string, string]> = [
    ["Service", appointment.service],
    ["Date & heure", `${formatParis(appointment.startAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} (heure de Paris)`],
    ["Statut", APPOINTMENT_STAGES[appointment.status].label],
    ["Référence", appointment.reference],
  ];

  return (
    <div className="border-2 border-ink bg-cream" role="status">
      <div className="flex items-center gap-3 border-b-2 border-ink bg-accent px-6 py-4 text-cream">
        <span className="flex h-8 w-8 items-center justify-center bg-cream text-accent">
          <CheckIcon className="h-5 w-5" />
        </span>
        <p className="font-display text-2xl">Demande enregistrée.</p>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:grid-cols-2">
        <dl className="space-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
              <dt className="font-mono text-xs text-ink-faint">{label}</dt>
              <dd className={label === "Référence" ? "text-right font-mono text-accent" : "text-right"}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-2 border-dashed border-line-strong p-4 text-sm leading-relaxed text-ink-soft">
          <p>
            Merci {name} ! Le créneau vous est réservé et attend ma confirmation :
            je reviens vers vous par e-mail sous 24 h ouvrées. Gardez la
            référence ci-contre pour tout échange à propos de ce rendez-vous.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-6 py-4 sm:flex-row sm:justify-between">
        <Link href="/" className="font-mono text-sm text-ink-soft hover:text-accent">
          ← Retour à l'accueil
        </Link>
        <Link href="/contact" className="inline-flex items-center gap-2 font-mono text-sm text-accent hover:underline">
          Une question ? Écrivez-moi <ArrowUpRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
