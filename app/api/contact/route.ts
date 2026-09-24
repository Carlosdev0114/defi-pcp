import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withErrors, parseJsonBody } from "@/lib/server/api";
import { getClientIp } from "@/lib/server/client-ip";
import { contactSchema } from "@/lib/server/validation";
import { checkLimits, tooManyRequests } from "@/lib/server/rate-limit";
import { notify } from "@/lib/server/audit";
import { bumpAdminVersion } from "@/lib/server/realtime";

export const CONTACT_LEAD_SOURCE = "Formulaire de contact";

/**
 * Formulaire de contact → Contact + Lead NEW + LeadEvent ∅→NEW +
 * notification, dans UNE transaction : tout ou rien (jamais de contact
 * orphelin sans lead, ni de lead sans historique). Anti-spam en amont :
 * validation Zod, rate limiting Redis par IP, pot de miel.
 * Voir DATABASE.md, « Contact et Lead ».
 */
export function POST(req: NextRequest) {
  return withErrors("POST /api/contact", async () => {
    const { data, error } = await parseJsonBody(req, contactSchema);
    if (error) return error;

    const limit = await checkLimits([["contact", getClientIp(req.headers)]]);
    if (!limit.success) return tooManyRequests(limit.reset);

    // Pot de miel rempli = bot. Réponse identique à un succès pour ne pas
    // lui apprendre à contourner le piège ; rien n'est enregistré.
    if (data.website) return NextResponse.json({ ok: true }, { status: 201 });

    const message = data.subject ? `[${data.subject}]\n\n${data.message}` : data.message;
    await db.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: { name: data.name, email: data.email.toLowerCase(), message },
      });
      const lead = await tx.lead.create({
        data: { contactId: contact.id, status: "NEW", source: CONTACT_LEAD_SOURCE },
      });
      await tx.leadEvent.create({ data: { leadId: lead.id, fromStatus: null, toStatus: "NEW" } });
      await notify(tx, "lead", {
        leadId: lead.id,
        contactId: contact.id,
        name: contact.name,
        subject: data.subject ?? null,
        status: "NEW",
      });
    });
    await bumpAdminVersion(); // après validation : le poll ne voit jamais une version en avance sur la base
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
