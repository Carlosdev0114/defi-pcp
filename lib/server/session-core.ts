import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { getRedis } from "@/lib/server/redis";

// Module sans dépendance à next/headers : utilisable depuis le proxy comme
// depuis les routes et les layouts.

export const SESSION_COOKIE = "pcs_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours
export const LOGIN_PATH = "/login";

export type SessionPayload = {
  sessionId: string;
  userId: string;
  role: Role;
  email: string;
  name: string;
};

const sessionKey = (sessionId: string) => `session:${sessionId}`;

function getSecret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return new TextEncoder().encode(value);
}

/**
 * Session = JWT signé (HS256) + entrée Redis `session:<jti>`.
 * Le JWT seul ne suffit pas : sans l'entrée Redis (déconnexion, révocation,
 * expiration), le jeton est refusé même si sa signature est valide.
 */
export async function createSession(
  user: Omit<SessionPayload, "sessionId">
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const token = await new SignJWT({ role: user.role, email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setJti(sessionId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());

  await getRedis().set(sessionKey(sessionId), user.userId, { ex: SESSION_TTL_SECONDS });
  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  let session: SessionPayload;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.jti || !payload.sub || typeof payload.role !== "string") return null;
    session = {
      sessionId: payload.jti,
      userId: payload.sub,
      role: payload.role as Role,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }

  const storedUserId = await getRedis().get<string>(sessionKey(session.sessionId));
  return storedUserId === session.userId ? session : null;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await getRedis().del(sessionKey(sessionId));
}
