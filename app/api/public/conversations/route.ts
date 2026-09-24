import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withErrors, parseJsonBody, apiError } from "@/lib/server/api";
import { getClientIp } from "@/lib/server/client-ip";
import { checkLimits, tooManyRequests } from "@/lib/server/rate-limit";
import { startConversationSchema } from "@/lib/schemas/message";
import { recordVisitorMessage, visitorConversationId } from "@/lib/server/messaging";
import { createVisitorToken, VISITOR_COOKIE, visitorCookieOptions } from "@/lib/server/visitor-token";
import { bumpAdminVersion, bumpConversationVersion } from "@/lib/server/realtime";

/** Ouvre une conversation visiteur (premier message) et remet au navigateur
 * le cookie signé qui y donne accès. Aucun identifiant n'est accepté du client. */
export function POST(req: NextRequest) {
  return withErrors("POST /api/public/conversations", async () => {
    const { data, error } = await parseJsonBody(req, startConversationSchema, 8 * 1024);
    if (error) return error;

    const existing = visitorConversationId(req);
    if (existing && (await db.conversation.findUnique({ where: { id: existing }, select: { id: true } }))) {
      return apiError("Une conversation est déjà ouverte dans ce navigateur.", 409);
    }

    const limit = await checkLimits([["conversationStart", getClientIp(req.headers)]]);
    if (!limit.success) return tooManyRequests(limit.reset);

    const { conversation, message } = await db.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: { visitorName: data.visitorName || null, visitorEmail: data.visitorEmail?.toLowerCase() || null },
        select: { id: true, visitorName: true },
      });
      const message = await recordVisitorMessage(tx, conversation.id, data.content, conversation.visitorName);
      return { conversation, message };
    });

    await Promise.all([bumpAdminVersion(), bumpConversationVersion(conversation.id)]);
    const response = NextResponse.json({ conversation: { visitorName: conversation.visitorName }, messages: [message] }, { status: 201 });
    response.cookies.set(VISITOR_COOKIE, createVisitorToken(conversation.id), visitorCookieOptions);
    return response;
  });
}
