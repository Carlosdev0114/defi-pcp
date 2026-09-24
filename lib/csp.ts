// Content-Security-Policy, source unique pour next.config.ts (pages
// publiques, en-tête statique) et proxy.ts (/admin et /login, nonce par
// requête). Pas d'import `server-only` : la config Next importe ce module.
//
// Deux variantes, qui ne diffèrent que par script-src :
//  - publique : 'unsafe-inline', car Next injecte dans chaque page statique
//    deux scripts inline (amorce + payload RSC propre à la page) qu'aucun
//    nonce ni hash ne peut couvrir sans rendre les pages dynamiques ;
//  - stricte (/admin, /login) : 'nonce-…' + 'strict-dynamic', plus aucun
//    'unsafe-inline' ; ces pages sont rendues à chaque requête.
// style-src garde 'unsafe-inline' partout : les composants utilisent des
// attributs style={…}, qu'un nonce ne couvre pas.

export type CspOptions = {
  isDev: boolean;
  /** Médias servis par le CDN Vercel Blob (STORAGE_DRIVER=vercel-blob). */
  blobImages: boolean;
  /** Présent → variante stricte avec nonce. */
  nonce?: string;
};

export function buildCsp({ isDev, blobImages, nonce }: CspOptions): string {
  const evalInDev = isDev ? " 'unsafe-eval'" : ""; // React en dev uniquement
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalInDev}`
    : `script-src 'self' 'unsafe-inline'${evalInDev}`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${blobImages ? " https://*.public.blob.vercel-storage.com" : ""}`,
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Options courantes, lues dans l'environnement. */
export function cspOptionsFromEnv(env: Record<string, string | undefined> = process.env): Omit<CspOptions, "nonce"> {
  return {
    isDev: env.NODE_ENV !== "production",
    blobImages: env.STORAGE_DRIVER === "vercel-blob",
  };
}

/** Routes servies avec la CSP stricte à nonce (et leurs sous-routes). */
export function isNonceRoute(pathname: string): boolean {
  return /^\/(admin|login)(\/|$)/.test(pathname);
}

/**
 * Motif `source` (next.config headers) des routes publiques : tout SAUF
 * /admin, /login et leurs sous-routes. Ces dernières reçoivent leur CSP du
 * proxy ; un second en-tête CSP s'y ajouterait sinon (les navigateurs
 * appliquent alors les deux politiques).
 */
export const PUBLIC_CSP_SOURCE = "/((?!admin(?:/|$)|login(?:/|$)).*)";

/** 128 bits aléatoires, encodés en base64 (neuf à chaque requête). */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
