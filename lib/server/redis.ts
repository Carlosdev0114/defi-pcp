import "server-only";
import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

/** Client Upstash (REST) partagé. Lève si la configuration manque : sans
 * Redis, ni les sessions ni le rate limiting ne sont fiables, donc on échoue
 * fermé plutôt que de laisser passer. */
export function getRedis(): Redis {
  if (globalForRedis.redis) return globalForRedis.redis;
  const url = process.env.REDIS_URL;
  const token = process.env.REDIS_TOKEN;
  if (!url || !token) {
    throw new Error("REDIS_URL / REDIS_TOKEN manquants dans l'environnement.");
  }
  globalForRedis.redis = new Redis({ url, token });
  return globalForRedis.redis;
}
