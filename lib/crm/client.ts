import { requestJson } from "@/lib/http/client";
import type { LeadStatus } from "@/lib/crm/stages";

// Accès du back-office CRM à l'API (toutes les routes vérifient la session
// admin côté serveur ; un 401 est remonté tel quel à l'interface).

export const LEADS_PAGE_SIZE = 20;

export type PipelineSummary = {
  stages: { status: LeadStatus; count: number; value: number }[];
  total: number;
  open: number;
  won: number;
  inProgressValue: number;
};

export type LeadListItem = {
  id: string;
  status: LeadStatus;
  value: number | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  contact: { name: string; email: string };
};

export type LeadsPage = {
  items: LeadListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pipeline: PipelineSummary;
};

export type LeadDetail = Omit<LeadListItem, "contact"> & {
  contact: { id: string; name: string; email: string; message: string; createdAt: string };
  notes: { id: string; content: string; createdAt: string }[];
  events: { id: string; fromStatus: LeadStatus | null; toStatus: LeadStatus; createdAt: string }[];
};

export function leadsUrl({ status, page }: { status: LeadStatus | null; page: number }) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(LEADS_PAGE_SIZE) });
  if (status) params.set("status", status);
  return `/api/admin/leads?${params}`;
}

export const fetchLeads = (query: { status: LeadStatus | null; page: number }) => requestJson<LeadsPage>(leadsUrl(query));

export const fetchLead = (id: string) => requestJson<LeadDetail>(`/api/admin/leads/${encodeURIComponent(id)}`);

export const updateLeadStatus = (id: string, status: LeadStatus) =>
  requestJson<unknown>(`/api/admin/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const addLeadNote = (id: string, content: string) =>
  requestJson<unknown>(`/api/admin/leads/${encodeURIComponent(id)}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export const formatEuros = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("fr-FR")} €`;
