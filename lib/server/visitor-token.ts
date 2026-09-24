import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Jeton d'accès d'un visiteur à SA conversation, sans compte ni colonne en
// base : { c: conversationId, e: expiration } signé HMAC-SHA256. La clé est
// dérivée de SESSION_SECRET avec un label propre à cet usage : un jeton de
// session admin ne peut pas servir de jeton visiteur, ni l'inverse.
// Le serveur ne fait jamais confiance à un identifiant de conversation envoyé
// par le client : seul ce cookie désigne la conversation.

export const VISITOR_COOKIE = "pcs_conv";
export const VISITOR_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours
const KEY_LABEL = "pcp/visitor-conversation/v1";

export const visitorCookieOptions = {
  httpOnly: true,
  secure: true, // les navigateurs l'acceptent aussi sur http://localhost
  sameSite: "lax" as const,
  path: "/",
  maxAge: VISITOR_TTL_SECONDS,
};

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET manquant ou trop court.");
  return createHmac("sha256", secret).update(KEY_LABEL).digest();
}

const b64url = (buf: Buffer) => buf.toString("base64url");
const sign = (payload: string) => b64url(createHmac("sha256", key()).update(payload).digest());

export function createVisitorToken(conversationId: string, now = Date.now()): string {
  const payload = b64url(Buffer.from(JSON.stringify({ c: conversationId, e: Math.floor(now / 1000) + VISITOR_TTL_SECONDS })));
  return `${payload}.${sign(payload)}`;
}

/** Identifiant de conversation si le jeton est authentique et non expiré, sinon null. */
export function verifyVisitorToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token || token.length > 512) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  // Comparaison en temps constant (longueurs égalisées d'abord).
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const { c, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { c?: unknown; e?: unknown };
    if (typeof c !== "string" || !/^[a-z0-9]{1,64}$/i.test(c) || typeof e !== "number") return null;
    return e * 1000 > now ? c : null;
  } catch {
    return null;
  }
}
