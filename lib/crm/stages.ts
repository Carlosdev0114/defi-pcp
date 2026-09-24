// Table de correspondance des stades du pipeline CRM — SEUL endroit où
// l'enum de la base (LeadStatus) est traduit pour l'interface. Module sans
// dépendance serveur : utilisé par les composants client et les pages.

export const LEAD_STATUSES = ["NEW", "CONTACTED", "DISCUSSION", "PROPOSAL", "WON", "LOST"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

type StageInfo = {
  /** Libellé affiché. */
  label: string;
  /** Classes de la pastille / carte (palette du design system). */
  tone: string;
  /** Stade encore « ouvert » (ni gagné ni perdu). */
  open: boolean;
};

export const LEAD_STAGES: Record<LeadStatus, StageInfo> = {
  NEW: { label: "Nouveau", tone: "border-accent bg-accent/10", open: true },
  CONTACTED: { label: "Contacté", tone: "border-[#d8a600] bg-[#d8a600]/10", open: true },
  DISCUSSION: { label: "Discussion", tone: "border-[#1855e0] bg-[#1855e0]/10", open: true },
  PROPOSAL: { label: "Proposition", tone: "border-[#4b3bf0] bg-[#4b3bf0]/10", open: true },
  WON: { label: "Gagné", tone: "border-[#0e8a60] bg-[#0e8a60]/15", open: false },
  LOST: { label: "Perdu", tone: "border-line-strong bg-paper", open: false },
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

export function stageLabel(status: LeadStatus): string {
  return LEAD_STAGES[status].label;
}

/** Stades qui comptent dans la valeur « en cours » du pipeline. */
export const IN_PROGRESS_STATUSES: LeadStatus[] = ["CONTACTED", "DISCUSSION", "PROPOSAL"];
