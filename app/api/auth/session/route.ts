import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/session";

export async function GET() {
  const session = await getCurrentSession().catch((error) => {
    console.error("/api/auth/session failed", error);
    return null;
  });
  if (!session) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  });
}
