// Appels à l'API depuis le navigateur. Toutes les erreurs de l'API ont la
// forme `{ error: string }` ; ce module les ramène à un résultat typé, sans
// jamais lever d'exception (erreur réseau comprise).

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      /** 0 = erreur réseau (pas de réponse). */
      status: number;
      error: string;
      /** Secondes à attendre (429 / 503), si l'API l'indique. */
      retryAfter: number | null;
    };

export const NETWORK_ERROR = "Connexion impossible. Vérifiez votre réseau puis réessayez.";
const GENERIC_ERROR = "Une erreur est survenue. Réessayez.";

/** Délai (s) si l'API renvoie 429/503 sans Retry-After exploitable. */
export const DEFAULT_RETRY_SECONDS = 60;
const MAX_RETRY_SECONDS = 3600;

/**
 * Retry-After : nombre de secondes, ou date HTTP. Renvoie un entier de
 * secondes borné à [1, 3600], ou null si l'en-tête est absent ou illisible.
 */
export function parseRetryAfter(header: string | null, now = Date.now()): number | null {
  if (header === null) return null;
  const value = header.trim();
  if (value === "") return null;

  let seconds: number;
  if (/^\d+$/.test(value)) {
    seconds = Number(value);
  } else {
    // Date HTTP uniquement (« Thu, 24 Sep 2026 10:00:30 GMT ») : Date.parse
    // accepte aussi des formes absurdes comme « -5 », refusées ici.
    if (!/[a-z]/i.test(value)) return null;
    const date = Date.parse(value);
    if (Number.isNaN(date)) return null;
    seconds = Math.ceil((date - now) / 1000);
  }
  return Math.min(MAX_RETRY_SECONDS, Math.max(1, seconds));
}

const isRetryable = (status: number) => status === 429 || status === 503;

export async function requestJson<T>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      // JSON seulement pour un corps texte : un FormData (envoi de fichier) fixe lui-même son en-tête.
      headers: { ...(typeof init.body === "string" ? { "content-type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR, retryAfter: null };
  }

  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);

  if (res.ok) return { ok: true, status: res.status, data: body as T };

  const message =
    body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : GENERIC_ERROR;
  const retryAfter = isRetryable(res.status)
    ? parseRetryAfter(res.headers.get("retry-after")) ?? DEFAULT_RETRY_SECONDS
    : null;
  return { ok: false, status: res.status, error: message, retryAfter };
}
