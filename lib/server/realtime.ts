import "server-only";
import { getRedis } from "@/lib/server/redis";

// « Temps réel » par polling court filtré par Redis (voir ARCHITECTURE.md).
// Chaque écriture intéressante incrémente un numéro de version ; le client
// interroge ce numéro et ne recharge les données (PostgreSQL) que s'il a
// changé. Les incréments sont BEST-EFFORT : s'ils échouent, l'écriture en base
// a déjà réussi et le rafraîchissement complet périodique du client rattrape.

const ADMIN_KEY = "rt:version";
const conversationKey = (id: string) => `rt:conv:${id}`;
const CONVERSATION_TTL = 60 * 60 * 24 * 31; // aligné sur le cookie visiteur (30 j)

async function bump(key: string, ttl?: number) {
  try {
    const redis = getRedis();
    await redis.incr(key);
    if (ttl) await redis.expire(key, ttl);
  } catch (error) {
    console.error(`realtime: incrément de ${key} impossible (rattrapé par le rafraîchissement complet)`, error);
  }
}

async function read(key: string): Promise<number | null> {
  try {
    return Number((await getRedis().get<number>(key)) ?? 0);
  } catch (error) {
    console.error(`realtime: lecture de ${key} impossible`, error);
    return null; // inconnu → le client doit recharger depuis la base
  }
}

/** Nouvel événement côté admin (message, lead, RDV, lecture…). */
export const bumpAdminVersion = () => bump(ADMIN_KEY);
export const getAdminVersion = () => read(ADMIN_KEY);

/** Nouveau message dans une conversation (vu par son visiteur). */
export const bumpConversationVersion = (conversationId: string) => bump(conversationKey(conversationId), CONVERSATION_TTL);
export const getConversationVersion = (conversationId: string) => read(conversationKey(conversationId));
