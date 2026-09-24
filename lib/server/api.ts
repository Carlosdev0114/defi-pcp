import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z, type ZodError, type ZodType } from "zod";
import { requireAdmin, unauthorized, type AdminUser } from "@/lib/server/guard";

export const MAX_JSON_BYTES = 16 * 1024;

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiValidationError(error: ZodError) {
  return NextResponse.json(
    {
      error: "Entrées invalides.",
      issues: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 400 }
  );
}

export function apiServerError() {
  return NextResponse.json({ error: "Erreur interne. Réessayez." }, { status: 500 });
}

/** Traduit les erreurs Prisma connues en réponses propres ; le reste = 500
 * générique (le détail part dans les logs serveur, jamais au client). */
export function handleApiError(scope: string, error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return apiError("Ressource introuvable.", 404);
    if (error.code === "P2002") return apiError("Cette valeur existe déjà.", 409);
    if (error.code === "P2003") return apiError("Ressource liée introuvable ou encore utilisée.", 409);
  }
  console.error(`${scope} failed`, error);
  return apiServerError();
}

/**
 * Lit un corps JSON borné en taille puis le valide avec Zod. Renvoie soit
 * les données typées, soit la réponse d'erreur prête à être retournée.
 */
export async function parseJsonBody<T>(
  req: NextRequest,
  schema: ZodType<T>,
  maxBytes = MAX_JSON_BYTES
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return { error: apiError("Content-Type application/json attendu.", 415) };
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { error: apiError("Corps de requête trop volumineux.", 413) };

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { error: apiError("Corps de requête illisible.", 400) };
  }
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { error: apiError("Corps de requête trop volumineux.", 413) };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: apiError("Corps JSON invalide.", 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return { error: apiValidationError(parsed.error) };
  return { data: parsed.data };
}

/** Valide des paramètres de query string (URLSearchParams → objet). */
export function parseQuery<T>(
  req: NextRequest,
  schema: ZodType<T>
): { data: T; error?: never } | { data?: never; error: NextResponse } {
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return { error: apiValidationError(parsed.error) };
  return { data: parsed.data };
}

// --- Pagination ------------------------------------------------------------

export const MAX_PAGE_SIZE = 50;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function toSkipTake({ page, pageSize }: Pagination) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(items: T[], total: number, { page, pageSize }: Pagination) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// --- Identifiants de route -------------------------------------------------

export const idSchema = z.string().min(1).max(64).regex(/^[a-z0-9]+$/i, "Identifiant invalide.");

export function parseId(value: string) {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// --- Enveloppe admin -------------------------------------------------------

/**
 * Enveloppe commune des routes admin : vérification serveur du rôle ADMIN
 * (session Redis + rôle en base), puis gestion d'erreurs sans fuite.
 */
export async function withAdmin(
  scope: string,
  handler: (admin: AdminUser) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    return await handler(admin);
  } catch (error) {
    return handleApiError(scope, error);
  }
}

/** Enveloppe des routes publiques : uniquement la gestion d'erreurs. */
export async function withErrors(
  scope: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return handleApiError(scope, error);
  }
}

/** ISO → Date en conservant la sémantique PATCH (undefined = inchangé,
 * null = effacer). */
export function toDate<T extends string | null | undefined>(
  value: T
): T extends string ? Date : Exclude<T, string> {
  return (typeof value === "string" ? new Date(value) : value) as never;
}
