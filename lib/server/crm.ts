import "server-only";
import { db } from "@/lib/server/db";
import { IN_PROGRESS_STATUSES, LEAD_STAGES, LEAD_STATUSES, type LeadStatus } from "@/lib/crm/stages";

export type PipelineStage = { status: LeadStatus; count: number; value: number };

export type PipelineSummary = {
  /** Un élément par stade, dans l'ordre du pipeline (0 si aucun lead). */
  stages: PipelineStage[];
  total: number;
  /** Leads ni gagnés ni perdus. */
  open: number;
  won: number;
  /** Valeur cumulée des stades Contacté / Discussion / Proposition. */
  inProgressValue: number;
};

type GroupRow = { status: LeadStatus; _count: { _all?: number } | true | undefined; _sum?: { value: number | null } | null };

/** Calcul pur (testable) à partir du groupBy Prisma. */
export function summarizePipeline(rows: GroupRow[]): PipelineSummary {
  const byStatus = new Map(rows.map((r) => [r.status, r]));
  const stages = LEAD_STATUSES.map((status) => {
    const row = byStatus.get(status);
    const count = row && typeof row._count === "object" ? row._count._all ?? 0 : 0;
    return { status, count, value: row?._sum?.value ?? 0 };
  });
  return {
    stages,
    total: stages.reduce((n, s) => n + s.count, 0),
    open: stages.filter((s) => LEAD_STAGES[s.status].open).reduce((n, s) => n + s.count, 0),
    won: stages.find((s) => s.status === "WON")?.count ?? 0,
    inProgressValue: stages.filter((s) => IN_PROGRESS_STATUSES.includes(s.status)).reduce((n, s) => n + s.value, 0),
  };
}

/** Totaux réels du pipeline (une requête groupBy). */
export async function getPipelineSummary(): Promise<PipelineSummary> {
  const rows = await db.lead.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { value: true },
    orderBy: { status: "asc" },
  });
  return summarizePipeline(rows as GroupRow[]);
}
