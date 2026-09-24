import { requestJson } from "@/lib/http/client";
import type { ZodError } from "zod";

// Appels du back-office pour les contenus éditoriaux (routes admin, 401 sans session).

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };
export type PublishFilter = "all" | "draft" | "published";
export const CONTENT_PAGE_SIZE = 20;

export function listUrl(resource: string, page: number, status: PublishFilter = "all") {
  const params = new URLSearchParams({ page: String(page), pageSize: String(CONTENT_PAGE_SIZE) });
  if (status !== "all") params.set("status", status);
  return `/api/admin/${resource}?${params}`;
}

export const fetchPage = <T>(resource: string, page: number, status?: PublishFilter) => requestJson<Page<T>>(listUrl(resource, page, status));
export const fetchOne = <T>(resource: string, id: string) => requestJson<T>(`/api/admin/${resource}/${encodeURIComponent(id)}`);
export const createItem = <T>(resource: string, body: unknown) => requestJson<T>(`/api/admin/${resource}`, { method: "POST", body: JSON.stringify(body) });
export const updateItem = <T>(resource: string, id: string, body: unknown) =>
  requestJson<T>(`/api/admin/${resource}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteItem = (resource: string, id: string) => requestJson<null>(`/api/admin/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Publie maintenant (`publishedAt` = maintenant) ou repasse en brouillon (`null`). */
export const setPublished = (resource: "projects" | "articles", id: string, published: boolean) =>
  updateItem(resource, id, { publishedAt: published ? new Date().toISOString() : null });

export const getConfig = <T>(name: "profile" | "settings" | "assistant") => requestJson<T>(`/api/admin/${name}`);
export const putConfig = <T>(name: "profile" | "settings" | "assistant", body: unknown) =>
  requestJson<T>(`/api/admin/${name}`, { method: "PUT", body: JSON.stringify(body) });

/** Premier message d'erreur Zod par champ (même format que la validation serveur). */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

/** Slug proposé à partir d'un titre (sans accents, a-z0-9 et tirets). */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
