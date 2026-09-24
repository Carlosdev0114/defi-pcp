import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireAdmin, unauthorized } from "@/lib/server/guard";
import { apiServerError } from "@/lib/server/api";

export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return unauthorized();

    const [users, projects, articles, leads, appointments, conversations] = await Promise.all([
      db.user.count(),
      db.project.count(),
      db.article.count(),
      db.lead.count(),
      db.appointment.count(),
      db.conversation.count(),
    ]);

    const [newLeads, pendingAppointments] = await Promise.all([
      db.lead.count({ where: { status: "NEW" } }),
      db.appointment.count({ where: { status: "PENDING" } }),
    ]);

    return NextResponse.json({
      user,
      counts: { users, projects, articles, leads, appointments, conversations },
      attention: { newLeads, pendingAppointments },
    });
  } catch (error) {
    console.error("/api/admin/overview failed", error);
    return apiServerError();
  }
}