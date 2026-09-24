import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseQuery, paginationSchema, paginated, toSkipTake } from "@/lib/server/api";

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/conversations", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const [items, total] = await db.$transaction([
      db.conversation.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          // Aperçu : uniquement le dernier message.
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { messages: true } },
        },
        ...toSkipTake(page),
      }),
      db.conversation.count(),
    ]);
    // Message n'a pas de champ « lu » : les non-lus sont les notifications
    // `message` non lues, regroupées par conversation (bornées à 1000).
    const unread = await db.notification.findMany({
      where: { type: "message", read: false },
      select: { payload: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const unreadBy = new Map<string, number>();
    for (const { payload } of unread) {
      const id = (payload as { conversationId?: unknown } | null)?.conversationId;
      if (typeof id === "string") unreadBy.set(id, (unreadBy.get(id) ?? 0) + 1);
    }
    return NextResponse.json(paginated(items.map((c) => ({ ...c, unread: unreadBy.get(c.id) ?? 0 })), total, page));
  });
}
