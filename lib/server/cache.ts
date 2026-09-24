import { getRedis } from "@/lib/server/redis";

/**
 * Cache Redis des lectures publiques (réduit les hits PostgreSQL).
 *
 * Invalidation par version : chaque ressource a un compteur
 * `cachever:<resource>` inclus dans la clé. Une écriture admin incrémente le
 * compteur → toutes les anciennes entrées deviennent inatteignables et
 * expirent d'elles-mêmes (TTL). Pas de SCAN/KEYS nécessaire.
 *
 * Le cache échoue ouvert : si Redis ne répond pas, on lit la base.
 */
export type CacheResource =
  | "projects"
  | "experiences"
  | "skills"
  | "articles"
  | "services"
  | "slots";

const DEFAULT_TTL = 300; // 5 min

export async function cached<T>(
  resource: CacheResource,
  key: string,
  load: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL
): Promise<T> {
  let fullKey: string | null = null;
  try {
    const redis = getRedis();
    const version = (await redis.get<number>(`cachever:${resource}`)) ?? 0;
    fullKey = `cache:${resource}:${version}:${key}`;
    const hit = await redis.get<T>(fullKey);
    if (hit !== null && hit !== undefined) return hit;
  } catch (error) {
    console.error("cache read failed", error);
  }

  const value = await load();

  if (fullKey) {
    try {
      // Aller-retour JSON : les Date deviennent des chaînes, comme dans la
      // réponse HTTP finale — le cache et la base renvoient la même forme.
      await getRedis().set(fullKey, JSON.parse(JSON.stringify(value)), { ex: ttlSeconds });
    } catch (error) {
      console.error("cache write failed", error);
    }
  }
  return value;
}

export async function invalidate(...resources: CacheResource[]): Promise<void> {
  try {
    const redis = getRedis();
    await Promise.all(resources.map((r) => redis.incr(`cachever:${r}`)));
  } catch (error) {
    // Au pire, les lectures restent périmées jusqu'au TTL (5 min).
    console.error("cache invalidation failed", error);
  }
}
