import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { getCurrentSession } from "@/lib/server/session";
import { LOGIN_PATH } from "@/lib/server/session-core";

export type AdminUser = { id: string; email: string; name: string | null };

/**
 * Seconde vérification serveur, indépendante du proxy : session valide
 * (JWT + Redis) ET utilisateur toujours présent en base avec le rôle ADMIN.
 * Un compte supprimé ou rétrogradé perd l'accès immédiatement, même si son
 * jeton n'a pas expiré. Aucune confiance accordée à un en-tête de requête.
 */
export async function requireAdmin(): Promise<AdminUser | null> {
  const session = await getCurrentSession().catch(() => null);
  if (!session || session.role !== "ADMIN") return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user || user.role !== "ADMIN") return null;
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * Vérification légère, réservée au polling (/api/admin/updates) : session
 * valide (JWT signé + entrée Redis, révocable) et rôle ADMIN dans le jeton,
 * SANS requête PostgreSQL — sinon chaque poll réveillerait la base. Toute
 * route qui lit ou modifie des données utilise requireAdmin() (rôle relu en
 * base). Voir SECURITY.md.
 */
export async function requireAdminSession(): Promise<{ id: string } | null> {
  const session = await getCurrentSession().catch(() => null);
  return session && session.role === "ADMIN" ? { id: session.userId } : null;
}

/** Variante pour les layouts / pages : redirige vers la connexion. */
export async function requireAdminPage(): Promise<AdminUser> {
  const user = await requireAdmin();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
}
