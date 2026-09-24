import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { ReservationStepper } from "@/components/site/reservation/ReservationStepper";
import { getModules } from "@/lib/server/site-config";

export const metadata: Metadata = {
  title: "Réservation",
  description: "Réserver un créneau : appel découverte, audit express, atelier cadrage ou journée d'accompagnement.",
};

export default async function BookingPage() {
  // Module désactivé dans les paramètres : page d'information (l'API refuse aussi).
  const { booking } = await getModules();
  return (
    <>
      <PageHeader
        index="07"
        label="Réservation"
        title={
          <>
            Un créneau, <span className="text-accent">et ça commence.</span>
          </>
        }
        lead="Choisissez un service, un jour, un créneau disponible : le reste se passe de vive voix. Quatre étapes, deux minutes."
      />
      <section className="page-pad mx-auto max-w-3xl py-16">
        {booking ? (
          <ReservationStepper />
        ) : (
          <p className="border-2 border-ink bg-cream p-6 text-center leading-relaxed text-ink-soft" role="status">
            La réservation en ligne est momentanément fermée. Écrivez-moi via la page Contact.
          </p>
        )}
      </section>
    </>
  );
}