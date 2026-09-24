import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withErrors, parseJsonBody, apiError } from "@/lib/server/api";
import { getClientIp } from "@/lib/server/client-ip";
import { checkLimits, tooManyRequests } from "@/lib/server/rate-limit";
import { messageSchema } from "@/lib/schemas/message";
import { recordVisitorMessage, visitorConversationId } from "@/lib/server/messaging";
import { bumpAdminVersion, bumpConversationVersion } from "@/lib/server/realtime";

/** Nouveau message du visiteur dans SA conversation (celle du cookie). */
export function POST(req: NextRequest) {
  return withErrors("POST /api/public/conversations/current/messages", async () => {
    const { data, error } = await parseJsonBody(req, messageSchema, 8 * 1024);
    if (error) return error;

    const conversationId = visitorConversationId(req);
    if (!conversationId) return apiError("Aucune conversation ouverte dans ce navigateur.", 404);

    // Par IP ET par conversation : changer d'IP ne contourne pas la limite.
    const limit = await checkLimits([
      ["messageIp", getClientIp(req.headers)],
      ["messageConversation", conversationId],
    ]);
    if (!limit.success) return tooManyRequests(limit.reset);

    const message = await db.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, select: { visitorName: true } });
      if (!conversation) return null;
      return recordVisitorMessage(tx, conversationId, data.content, conversation.visitorName);
    });
    if (!message) return apiError("Aucune conversation ouverte dans ce navigateur.", 404);

    await Promise.all([bumpAdminVersion(), bumpConversationVersion(conversationId)]);
    return NextResponse.json({ message }, { status: 201 });
  });
}
