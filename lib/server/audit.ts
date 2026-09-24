import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Journal d'audit (modèle Activity). Appelé dans la même transaction que
 * l'écriture qu'il décrit : pas d'action sans trace, pas de trace fantôme. */
export function logActivity(
  tx: Tx,
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null
) {
  return tx.activity.create({ data: { userId, action, entity, entityId: entityId ?? null } });
}

export type NotificationType = "message" | "lead" | "booking" | "contact";

/** Notification du dashboard admin, `payload` libre selon le type. */
export function notify(tx: Tx, type: NotificationType, payload: Prisma.InputJsonObject) {
  return tx.notification.create({ data: { type, payload } });
}
