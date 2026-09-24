import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { SignJWT } from "jose";
import { createVisitorToken, verifyVisitorToken, VISITOR_TTL_SECONDS, visitorCookieOptions } from "@/lib/server/visitor-token";

const SECRET = "x".repeat(48);

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
});

const b64url = (s: string) => Buffer.from(s).toString("base64url");

describe("jeton d'accès visiteur à SA conversation", () => {
  it("aller-retour : le jeton désigne la conversation qui l'a émis", () => {
    expect(verifyVisitorToken(createVisitorToken("convA"))).toBe("convA");
  });

  it("cookie forgé (signature inventée) → refusé", () => {
    const payload = b64url(JSON.stringify({ c: "convA", e: Math.floor(Date.now() / 1000) + 3600 }));
    expect(verifyVisitorToken(`${payload}.${b64url("signature-inventée-de-même-longueur!!")}`)).toBeNull();
    expect(verifyVisitorToken("n'importe-quoi")).toBeNull();
    expect(verifyVisitorToken("")).toBeNull();
    expect(verifyVisitorToken(undefined)).toBeNull();
  });

  it("jeton d'une autre conversation : échanger l'identifiant casse la signature", () => {
    const [, signatureA] = createVisitorToken("convA").split(".");
    const [payloadB] = createVisitorToken("convB").split(".");
    expect(verifyVisitorToken(`${payloadB}.${signatureA}`)).toBeNull();
    // Et un jeton valide pour B ne donne jamais accès à A.
    expect(verifyVisitorToken(createVisitorToken("convB"))).toBe("convB");
  });

  it("jeton expiré → refusé", () => {
    const issued = Date.now() - (VISITOR_TTL_SECONDS + 60) * 1000;
    expect(verifyVisitorToken(createVisitorToken("convA", issued))).toBeNull();
    expect(verifyVisitorToken(createVisitorToken("convA", Date.now() - 60_000))).toBe("convA");
  });

  it("clé dérivée avec un label propre : une signature faite avec le secret brut est refusée", () => {
    const payload = b64url(JSON.stringify({ c: "convA", e: Math.floor(Date.now() / 1000) + 3600 }));
    const rawKeySignature = createHmac("sha256", SECRET).update(payload).digest("base64url");
    expect(verifyVisitorToken(`${payload}.${rawKeySignature}`)).toBeNull();
  });

  it("un jeton de session admin (JWT) n'est pas un jeton visiteur", async () => {
    const jwt = await new SignJWT({ role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject("admin").setJti("s1").sign(new TextEncoder().encode(SECRET));
    expect(verifyVisitorToken(jwt)).toBeNull();
  });

  it("un autre SESSION_SECRET invalide les jetons existants", () => {
    const token = createVisitorToken("convA");
    vi.stubEnv("SESSION_SECRET", "y".repeat(48));
    expect(verifyVisitorToken(token)).toBeNull();
  });

  it("cookie : HttpOnly, Secure, SameSite=Lax, 30 jours", () => {
    expect(visitorCookieOptions).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", maxAge: 30 * 24 * 3600 });
  });
});
