"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useRemote } from "@/lib/hooks/use-remote";
import { bookingVisitorSchema } from "@/lib/schemas/booking";
import {
  createAppointment,
  fetchAvailability,
  fetchServices,
  fetchSlots,
  type BookedAppointment,
  type PublicService,
  type Slot,
} from "@/lib/booking/client";
import { StepIndicator } from "./StepIndicator";
import { ServiceStep } from "./ServiceStep";
import { DayStep } from "./DayStep";
import { SlotStep } from "./SlotStep";
import { ContactStep, type VisitorErrors, type VisitorValues } from "./ContactStep";
import { ConfirmationStep } from "./ConfirmationStep";

const EMPTY_VISITOR: VisitorValues = { visitorName: "", visitorEmail: "", notes: "" };

/** Réservation : service → jour → créneau → coordonnées → confirmation.
 * Toutes les données viennent de l'API ; le serveur revérifie tout. */
export function ReservationStepper() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState<PublicService | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [visitor, setVisitor] = useState<VisitorValues>(EMPTY_VISITOR);
  const [errors, setErrors] = useState<VisitorErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<BookedAppointment | null>(null);
  const [version, setVersion] = useState(0); // recharge les dispos après un refus

  const services = useRemote("services", fetchServices);
  const days = useRemote(service && step === 1 ? `days:${service.id}:${version}` : null, () => fetchAvailability(service!.id));
  const slots = useRemote(service && date && step === 1 ? `slots:${service.id}:${date}:${version}` : null, () => fetchSlots(service!.id, date!));

  const canNext = (step === 0 && service) || (step === 1 && slot) || step === 2;

  const submit = async () => {
    const checked = bookingVisitorSchema.safeParse({ ...visitor, notes: visitor.notes || undefined });
    if (!checked.success) {
      setErrors(Object.fromEntries(checked.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setSubmitting(true);
    setNotice(null);
    const result = await createAppointment({ serviceId: service!.id, startAt: slot!.startAt, ...checked.data });
    setSubmitting(false);
    if (result.ok) {
      setBooked(result.data.appointment);
      setStep(3);
      return;
    }
    setNotice(result.error);
    if (result.status === 409 || result.status === 400) {
      // Créneau pris entre-temps ou devenu invalide : retour au choix du créneau, dispos rafraîchies.
      setSlot(null);
      setVersion((v) => v + 1);
      setStep(1);
    }
  };

  const next = () => {
    if (!canNext || submitting) return;
    if (step === 2) submit();
    else setStep((s) => s + 1);
  };

  if (step === 3 && booked) return <ConfirmationStep appointment={booked} name={visitor.visitorName} />;

  return (
    <div className="mx-auto max-w-3xl">
      <StepIndicator step={step} />
      <div className="border-2 border-ink bg-cream p-6 sm:p-8">
        {notice ? (
          <p className="mb-6 border-2 border-accent bg-accent/10 p-3 font-mono text-xs text-accent-ink" role="alert">
            {notice}
          </p>
        ) : null}

        {step === 0 ? (
          services.result?.ok ? (
            <ServiceStep services={services.result.data.items} selected={service} onPick={(s) => { setService(s); setDate(null); setSlot(null); }} />
          ) : (
            <p className="font-mono text-sm text-ink-faint" role="status">
              {services.result && !services.result.ok ? services.result.error : "Chargement des services…"}
            </p>
          )
        ) : null}

        {step === 1 ? (
          <div className="space-y-8">
            {days.result?.ok ? (
              <DayStep days={days.result.data.items} selected={date} onPick={(d) => { setDate(d); setSlot(null); }} />
            ) : (
              <p className="font-mono text-sm text-ink-faint" role="status">
                {days.result && !days.result.ok ? days.result.error : "Chargement des disponibilités…"}
              </p>
            )}
            {date ? (
              <SlotStep date={date} slots={slots.result?.ok ? slots.result.data.items : []} loading={slots.loading} selected={slot} onPick={setSlot} />
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <ContactStep values={visitor} errors={errors} onChange={(f, v) => { setVisitor((x) => ({ ...x, [f]: v })); setErrors((e) => ({ ...e, [f]: undefined })); }} />
        ) : null}

        <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting} className="font-mono text-sm text-ink-soft transition-colors hover:text-accent disabled:opacity-40">
            ← Retour
          </button>
          <button
            onClick={next}
            disabled={!canNext || submitting}
            className={cn(
              "border-2 px-6 py-3 font-mono text-sm transition-colors",
              canNext && !submitting ? "border-ink bg-accent text-cream hover:bg-accent-strong" : "cursor-not-allowed border-line bg-paper text-ink-faint"
            )}
          >
            {step === 2 ? (submitting ? "Réservation…" : "Confirmer la réservation") : "Continuer →"}
          </button>
        </div>
      </div>
      <p className="mt-6 text-center font-mono text-xs text-ink-faint">Toutes les heures sont indiquées en heure de Paris.</p>
    </div>
  );
}
