// Statuts de rendez-vous : libellés, transitions autorisées et référence
// affichée. SEUL endroit où ces règles existent (API et interface).

export const APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED", "DECLINED", "CANCELLED", "COMPLETED"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STAGES: Record<AppointmentStatus, { label: string; tone: string }> = {
  PENDING: { label: "En attente de confirmation", tone: "border-accent bg-accent/10" },
  CONFIRMED: { label: "Confirmé", tone: "border-[#0e8a60] bg-[#0e8a60]/10" },
  DECLINED: { label: "Refusé", tone: "border-line-strong bg-paper" },
  CANCELLED: { label: "Annulé", tone: "border-line-strong bg-paper" },
  COMPLETED: { label: "Terminé", tone: "border-[#1855e0] bg-[#1855e0]/10" },
};

/** Transitions autorisées : un RDV refusé, annulé ou terminé est figé. */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "DECLINED", "CANCELLED"],
  CONFIRMED: ["CANCELLED", "COMPLETED"],
  DECLINED: [],
  CANCELLED: [],
  COMPLETED: [],
};

/** Libellé du bouton qui mène à chaque statut. */
export const APPOINTMENT_ACTIONS: Record<AppointmentStatus, string> = {
  PENDING: "",
  CONFIRMED: "Accepter",
  DECLINED: "Refuser",
  CANCELLED: "Annuler",
  COMPLETED: "Marquer terminé",
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

/**
 * Référence communiquée au visiteur et affichée dans l'admin, dérivée de
 * l'identifiant réel du RDV (8 derniers caractères du CUID) : les deux
 * côtés affichent la même, sans stocker de colonne supplémentaire.
 */
export function appointmentReference(id: string): string {
  return `RDV-${id.slice(-8).toUpperCase()}`;
}
