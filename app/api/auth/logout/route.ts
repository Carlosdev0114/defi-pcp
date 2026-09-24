import { NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";

export async function POST() {
  try {
    await destroySession();
  } catch (error) {
    // Redis indisponible : le cookie est tout de même effacé côté client, et
    // l'entrée Redis expirera avec son TTL.
    console.error("/api/auth/logout: revocation failed", error);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
