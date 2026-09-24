import "server-only";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { notify } from "@/lib/server/audit";
import { VISITOR_COOKIE, verifyVisitorToken } from "@/lib/server/visitor-token";

type Tx = Prisma.TransactionClient;

/** Conversation du visiteur, lue UNIQUEMENT dans son cookie signé. */
export function visitorConversationId(req: NextRequest): string | null {
  return verifyVisitorToken(req.cookies.get(VISITOR_COOKIE)?.value);
}

/** Champs exposés au visiteur : jamais d'identifiant d'admin ni de métadonnée interne. */
export const publicMessageSelect = { id: true, sender: true, content: true, createdAt: true } as const;

const PAGE = 50;

/** Messages d'UNE conversation : les 50 derniers, ou ceux postérieurs à `afterId`
 * (curseur vérifié comme appartenant à cette même conversation). */
export async function listMessages(conversationId: string, afterId?: string) {
  if (afterId) {
    const cursor = await db.message.findFirst({ where: { id: afterId, conversationId }, select: { createdAt: true } });
    if (cursor) {
      return db.message.findMany({
        where: { conversationId, createdAt: { gt: cursor.createdAt } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: PAGE,
        select: publicMessageSelect,
      });
    }
  }
  const latest = await db.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE,
    select: publicMessageSelect,
  });
  return latest.reverse();
}

/** Message d'un visiteur + notification admin, dans la transaction de l'appelant. */
export async function recordVisitorMessage(tx: Tx, conversationId: string, content: string, visitorName: string | null) {
  const message = await tx.message.create({
    data: { conversationId, sender: "VISITOR", content },
    select: publicMessageSelect,
  });
  await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  await notify(tx, "message", { conversationId, messageId: message.id, name: visitorName ?? "Visiteur" });
  return message;
}
