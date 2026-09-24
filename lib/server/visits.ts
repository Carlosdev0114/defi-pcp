import "server-only";
import { getRedis } from "@/lib/server/redis";
import { addDays, localDate } from "@/lib/time/paris";
import { getPublishedSlugs } from "@/lib/server/content";

// Mesure d'audience minimale, sans outil externe ni donnée personnelle :
// uniquement des COMPTEURS de pages vues par jour (Europe/Paris) et par
// chemin. Ni IP, ni cookie, ni identifiant, ni User-Agent n'est conservé.
// Limite assumée : pages vues, pas visiteurs uniques.
//
//   visits:d:<AAAA-MM-JJ>  → entier (pages vues du jour)
//   visits:p:<AAAA-MM-JJ>  → hash { chemin: pages vues }

const RETENTION_SECONDS = 60 * 60 * 24 * 400;
const dayKey = (d: string) => `visits:d:${d}`;
const pathKey = (d: string) => `visits:p:${d}`;

// Chemins connus : les pages statiques du site + les pages de détail des
// contenus PUBLIÉS (slugs lus en base). Mémorisés 5 min par instance pour ne
// pas interroger la base à chaque page vue ; remis à zéro sur l'instance qui
// publie (resetKnownPaths). Un nouveau slug peut donc n'être compté qu'après
// 5 min sur les autres instances.
const STATIC_PATHS = ["/", "/a-propos", "/parcours", "/competences", "/projets", "/articles", "/contact", "/reservation"];
const KNOWN_TTL_MS = 5 * 60_000;
const memo = globalThis as unknown as { knownPaths?: { at: number; paths: Set<string> } };

async function knownPaths(now = Date.now()): Promise<Set<string>> {
  if (memo.knownPaths && now - memo.knownPaths.at < KNOWN_TTL_MS) return memo.knownPaths.paths;
  const { projects, articles } = await getPublishedSlugs();
  const paths = new Set([...STATIC_PATHS, ...projects.map((s) => `/projets/${s}`), ...articles.map((s) => `/articles/${s}`)]);
  memo.knownPaths = { at: now, paths };
  return paths;
}

export function resetKnownPaths() {
  memo.knownPaths = undefined;
}

/** Chemin normalisé s'il correspond à une page publique connue, sinon null. */
export async function knownPath(raw: unknown): Promise<string | null> {
  if (typeof raw !== "string" || raw.length > 200) return null;
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return (await knownPaths()).has(path) ? path : null;
}

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|curl|wget|python-requests|httpclient|monitor/i;

/** Robots et outils (User-Agent lu puis oublié). Absent = on ne compte pas. */
export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

export async function recordVisit(path: string, now = new Date()): Promise<void> {
  const day = localDate(now);
  const pipeline = getRedis().pipeline();
  pipeline.incr(dayKey(day));
  pipeline.expire(dayKey(day), RETENTION_SECONDS);
  pipeline.hincrby(pathKey(day), path, 1);
  pipeline.expire(pathKey(day), RETENTION_SECONDS);
  await pipeline.exec();
}

export type VisitStats = {
  days: { date: string; views: number }[];
  total: number;
  previousTotal: number;
  topPages: { path: string; views: number }[];
};

/** Pages vues des `days` derniers jours (+ période précédente pour la tendance). */
export async function getVisitStats(days = 30, now = new Date()): Promise<VisitStats> {
  const today = localDate(now);
  const dates = Array.from({ length: days * 2 }, (_, i) => addDays(today, i - days * 2 + 1));
  const recent = dates.slice(days);

  const redis = getRedis();
  const counts = (await redis.mget<(number | string | null)[]>(...dates.map(dayKey))).map((v) => Number(v ?? 0));
  const pipeline = redis.pipeline();
  for (const d of recent) pipeline.hgetall(pathKey(d));
  const perDay = (await pipeline.exec()) as (Record<string, number | string> | null)[];

  const byPath = new Map<string, number>();
  for (const hash of perDay) {
    for (const [path, n] of Object.entries(hash ?? {})) byPath.set(path, (byPath.get(path) ?? 0) + Number(n));
  }

  return {
    days: recent.map((date, i) => ({ date, views: counts[days + i] })),
    total: counts.slice(days).reduce((a, b) => a + b, 0),
    previousTotal: counts.slice(0, days).reduce((a, b) => a + b, 0),
    topPages: [...byPath.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
      .slice(0, 10),
  };
}
