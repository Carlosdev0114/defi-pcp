import { requestJson } from "@/lib/http/client";
import type { AvailabilitySlot } from "@/lib/schemas/services";

// Appels du back-office pour les services réservables (routes admin, 401
// sans session). Liste, création, modification et suppression passent par
// les helpers génériques de lib/admin/client.ts (ressource "services").

export type ServiceRow = {
  id: string;
  name: string;
  durationMin: number;
  description: string | null;
  active: boolean;
  availability: (AvailabilitySlot & { id: string })[];
};

export const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

/** Remplace tout le planning hebdomadaire du service (atomique côté serveur). */
export const replaceAvailability = (serviceId: string, slots: AvailabilitySlot[]) =>
  requestJson<{ items: (AvailabilitySlot & { id: string })[] }>(`/api/admin/services/${encodeURIComponent(serviceId)}/availability`, {
    method: "PUT",
    body: JSON.stringify({ slots }),
  });
