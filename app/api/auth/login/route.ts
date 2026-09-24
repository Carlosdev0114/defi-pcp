import { NextRequest, NextResponse } from "next/server";
import { compare, hashSync } from "bcryptjs";
import { db } from "@/lib/server/db";
import { loginSchema } from "@/lib/server/validation";
import { apiError, apiServerError, parseJsonBody } from "@/lib/server/api";
import { getClientIp } from "@/lib/server/client-ip";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/server/session";
import { limitLogin, tooManyRequests } from "@/lib/server/rate-limit";

// Hash factice calculé au démarrage : quand l'e-mail est inconnu, on compare
// quand même pour égaliser le temps de réponse (anti-énumération de comptes).
const DUMMY_HASH = hashSync("pcp-dummy-password-never-valid", 10);

export async function POST(req: NextRequest) {
  const { data, error } = await parseJsonBody(req, loginSchema);
  if (error) return error;

  const email = data.email.toLowerCase();

  try {
    const { success, reset } = await limitLogin(getClientIp(req.headers), email);
    if (!success) return tooManyRequests(reset);

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    });
    const valid = await compare(data.password, user?.passwordHash ?? DUMMY_HASH);
    // Même message pour e-mail inconnu, mot de passe faux ou rôle insuffisant.
    if (!user || !valid || user.role !== "ADMIN") {
      return apiError("Identifiants incorrects.", 401);
    }

    const token = await createSession({
      userId: user.id,
      role: user.role,
      email: user.email,
      name: user.name ?? "",
    });

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (err) {
    console.error("/api/auth/login failed", err);
    return apiServerError();
  }
}
