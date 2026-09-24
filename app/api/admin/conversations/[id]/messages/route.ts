import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, parseQuery, parseId, apiError } from "@/lib/server/api";
import { adminMessageSchema } from "@/lib/server/validation";
import { logActivity } from "@/lib/server/audit";
import { bumpAdminVersion, bumpConversationVersion } from "@/lib/server/realtime";

type Ctx = RouteContext<"/api/admin/conversations/[id]/messages">;

// Pagination par curseur (id du plus ancien message déjà affiché) : adaptée
// à un fil qu'on remonte, et stable même si de nouveaux messages arrivent.
const querySchema = z.object({
  before: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export function GET(req: NextRequest, ctx: Ctx) {
  return withAdmin("GET conversation messages", async () => {
    const conversationId = parseId((await ctx.params).id);
    if (!conversationId) return apiError("Identifiant invalide.", 400);
    const { data: q, error } = parseQuery(req, querySchema);
    if (error) return error;

    const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) return apiError("Conversation introuvable.", 404);

    const page = await db.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
      ...(q.before ? { cursor: { id: q.before }, skip: 1 } : {}),
    });
    const hasMore = page.length > q.limit;
    const items = page.slice(0, q.limit).reverse();
    return NextResponse.json({
      conversation,
      items,
      nextCursor: hasMore ? items[0]?.id ?? null : null,
    });
  });
}

export function POST(req: NextRequest, ctx: Ctx) {
  return withAdmin("POST conversation message", async (admin) => {
    const conversationId = parseId((await ctx.params).id);
    if (!conversationId) return apiError("Identifiant invalide.", 400);
    const { data, error } = await parseJsonBody(req, adminMessageSchema);
    if (error) return error;

    const message = await db.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, sender: "ADMIN", content: data.content },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      await logActivity(tx, admin.id, "message.reply", "conversation", conversationId);
      return created;
    });
    await Promise.all([bumpConversationVersion(conversationId), bumpAdminVersion()]);
    return NextResponse.json(message, { status: 201 });
  });
}
