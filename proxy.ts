import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  LOGIN_PATH,
  verifySession,
  type SessionPayload,
} from "@/lib/server/session-core";
import { buildCsp, cspOptionsFromEnv, generateNonce, isNonceRoute } from "@/lib/csp";

// Première barrière RBAC (Next 16 : ex-middleware). Elle ne remplace pas les
// vérifications dans les routes et le layout admin (voir lib/server/guard) :
// chaque couche revérifie la session et le rôle côté serveur.

const ADMIN_API_PREFIX = "/api/admin";

// Routes API publiques : tout le reste sous /api est refusé tant qu'il n'est
// pas explicitement listé (on bloque par défaut plutôt que par liste noire).
const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/contact",
  "/api/appointments",
  "/api/chat",
]);
// Lectures publiques en lecture seule (contenus publiés, créneaux).
const PUBLIC_API_PREFIX = "/api/public/";

const isPublicApi = (pathname: string) =>
  PUBLIC_API.has(pathname) || pathname.startsWith(PUBLIC_API_PREFIX);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Défense CSRF en plus de SameSite=Lax : une requête qui modifie l'état doit
 * venir de la même origine que le site. */
function isCrossOrigin(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return false;
  const origin = req.headers.get("origin");
  if (!origin) return false; // clients non navigateur : pas de cookie ambiant exploitable
  return origin !== req.nextUrl.origin;
}

const isAdminPath = (pathname: string) =>
  pathname === "/admin" || pathname.startsWith("/admin/");

const isAdminApi = (pathname: string) =>
  pathname === ADMIN_API_PREFIX || pathname.startsWith(`${ADMIN_API_PREFIX}/`);

async function readSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch (error) {
    // Secret ou Redis indisponible : on échoue fermé.
    console.error("proxy: session verification failed", error);
    return null;
  }
}

/**
 * CSP stricte des pages sensibles (/admin, /login et sous-routes) : nonce
 * neuf à chaque requête + 'strict-dynamic', sans 'unsafe-inline'. Next lit
 * le nonce dans l'en-tête CSP de la REQUÊTE et l'applique à ses propres
 * scripts ; ces pages sont rendues dynamiquement (voir app/(admin)).
 * Les pages publiques gardent l'en-tête statique de next.config.ts.
 */
function nextWithNonce(req: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp({ ...cspOptionsFromEnv(), nonce });
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/") && isCrossOrigin(req)) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  if (pathname === LOGIN_PATH) {
    const session = await readSession(req);
    if (session?.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return nextWithNonce(req);
  }

  if (isAdminApi(pathname)) {
    const session = await readSession(req);
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isAdminPath(pathname)) {
    const session = await readSession(req);
    if (session?.role !== "ADMIN") {
      const url = new URL(LOGIN_PATH, req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return nextWithNonce(req);
  }

  if (pathname.startsWith("/api/") && !isPublicApi(pathname)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  // Sous-routes éventuelles de /login : même CSP stricte (next.config les exclut).
  return isNonceRoute(pathname) ? nextWithNonce(req) : NextResponse.next();
}

export const config = {
  // Tout sauf les assets statiques et les fichiers image.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt)$).*)"],
};
