import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySession,
  revokeSession,
  type SessionPayload,
} from "@/lib/server/session-core";

export { SESSION_COOKIE, createSession } from "@/lib/server/session-core";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Supprime la session côté Redis : le cookie restant devient inutilisable. */
export async function destroySession(): Promise<void> {
  const session = await getCurrentSession();
  if (session) await revokeSession(session.sessionId);
}
