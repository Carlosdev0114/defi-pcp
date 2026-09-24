import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withErrors, parseQuery } from "@/lib/server/api";
import { listMessages, visitorConversationId } from "@/lib/server/messaging";
import { getConversationVersion } from "@/lib/server/realtime";
import { VISITOR_COOKIE } from "@/lib/server/visitor-token";

const querySchema = z.object({
  /** Version déjà connue du client : inchangée → réponse sans toucher à PostgreSQL. */
  since: z.coerce.number().int().min(0).optional(),
  /** Dernier message déjà affiché : seuls les suivants sont renvoyés. */
  after: z.string().max(64).optional(),
});

/** Fil du visiteur (sa conversation, désignée par son cookie), avec polling filtré par Redis. */
export function GET(req: NextRequest) {
  return withErrors("GET /api/public/conversations/current", async () => {
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;

    const conversationId = visitorConversationId(req);
    if (!conversationId) return NextResponse.json({ conversation: null });

    const version = await getConversationVersion(conversationId);
    if (q.since !== undefined && version !== null && version === q.since) {
      return NextResponse.json({ changed: false, version });
    }

    const conversation = await db.conversation.findUnique({ where: { id: conversationId }, select: { visitorName: true } });
    if (!conversation) {
      const response = NextResponse.json({ conversation: null });
      response.cookies.delete(VISITOR_COOKIE); // conversation supprimée : cookie orphelin
      return response;
    }

    const messages = await listMessages(conversationId, q.after);
    return NextResponse.json({ changed: true, version: version ?? 0, conversation, messages });
  });
}
