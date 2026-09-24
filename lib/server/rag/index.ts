import { after } from "next/server";
import { getRedis } from "@/lib/server/redis";
import { chunkDocs, loadKnowledge } from "@/lib/server/rag/knowledge";
import { embedDocuments, embedQuery, EMBEDDING_DIMS, EMBEDDING_MODEL } from "@/lib/server/rag/gemini";

// Index vectoriel stocké dans Redis (corpus de quelques dizaines de morceaux :
// une recherche exhaustive par similarité cosinus en mémoire suffit
// largement et évite d'ajouter pgvector au schéma imposé).
//
//   rag:meta            → { buildId, builtAt, count, model, dims }
//   rag:chunks:<build>  → hash { chunkId: JSON { source, title, text, emb } }
//   rag:stale           → "1" quand le contenu a changé depuis le build
//   rag:lock            → verrou de reconstruction (NX, 120 s)
//   rag:cooldown        → fenêtre de 10 min entre deux reconstructions

const META = "rag:meta";
const STALE = "rag:stale";
const LOCK = "rag:lock";
const COOLDOWN = "rag:cooldown";
const chunksKey = (buildId: string) => `rag:chunks:${buildId}`;

export type IndexMeta = { buildId: string; builtAt: string; count: number; model: string; dims: number };
type StoredChunk = { source: string; title: string; text: string; emb: string };
type LoadedChunk = { source: string; title: string; text: string; vector: Float32Array; norm: number };

const encode = (v: number[]) => Buffer.from(new Float32Array(v).buffer).toString("base64");
const decode = (s: string) => {
  const buf = Buffer.from(s, "base64");
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
};
const norm = (v: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
};

const globalForRag = globalThis as unknown as { ragMemo?: { buildId: string; chunks: LoadedChunk[] } };

export async function getIndexMeta(): Promise<(IndexMeta & { stale: boolean }) | null> {
  const redis = getRedis();
  const [meta, stale] = await Promise.all([redis.get<IndexMeta>(META), redis.get(STALE)]);
  return meta ? { ...meta, stale: Boolean(stale) } : null;
}

/** Appelé après toute écriture sur un contenu public. */
export async function markRagStale() {
  try {
    await getRedis().set(STALE, "1");
  } catch (error) {
    console.error("markRagStale failed", error);
  }
}

export const REBUILD_COOLDOWN_SECONDS = 600; // au plus une reconstruction toutes les 10 min

export type RebuildResult =
  | { status: "built"; meta: IndexMeta }
  | { status: "running" }
  | { status: "cooldown"; retryInSeconds: number };

/**
 * Reconstruit l'index. Garde-fous (quota Gemini) : une seule reconstruction à
 * la fois (verrou), et au plus une toutes les 10 min (fenêtre posée AU
 * DÉBUT : une reconstruction qui échoue compte aussi). L'index précédent
 * reste en service jusqu'à la bascule finale.
 */
export async function rebuildIndex(): Promise<RebuildResult> {
  const redis = getRedis();
  const locked = await redis.set(LOCK, "1", { nx: true, ex: 120 });
  if (!locked) return { status: "running" };
  try {
    const windowOpened = await redis.set(COOLDOWN, "1", { nx: true, ex: REBUILD_COOLDOWN_SECONDS });
    if (!windowOpened) return { status: "cooldown", retryInSeconds: Math.max(1, await redis.ttl(COOLDOWN)) };

    // Le drapeau est levé AVANT de lire la base : une écriture concurrente
    // pendant le build le reposera et déclenchera un nouveau build.
    await redis.del(STALE);
    const chunks = chunkDocs(await loadKnowledge());
    const vectors = chunks.length ? await embedDocuments(chunks) : [];

    const buildId = crypto.randomUUID();
    const entries: Record<string, string> = {};
    chunks.forEach((c, i) => {
      entries[c.id] = JSON.stringify({ source: c.source, title: c.title, text: c.text, emb: encode(vectors[i]) } satisfies StoredChunk);
    });
    if (chunks.length) await redis.hset(chunksKey(buildId), entries);

    const previous = await redis.get<IndexMeta>(META);
    const meta: IndexMeta = { buildId, builtAt: new Date().toISOString(), count: chunks.length, model: EMBEDDING_MODEL, dims: EMBEDDING_DIMS };
    await redis.set(META, meta);
    if (previous) await redis.del(chunksKey(previous.buildId));
    return { status: "built", meta };
  } finally {
    await redis.del(LOCK);
  }
}

/** Secondes avant qu'une nouvelle reconstruction soit permise (0 = possible). */
export async function rebuildCooldownSeconds(): Promise<number> {
  return Math.max(0, await getRedis().ttl(COOLDOWN));
}

async function loadChunks(meta: IndexMeta): Promise<LoadedChunk[]> {
  const memo = globalForRag.ragMemo;
  if (memo?.buildId === meta.buildId) return memo.chunks;

  const raw = (await getRedis().hgetall<Record<string, StoredChunk | string>>(chunksKey(meta.buildId))) ?? {};
  const chunks = Object.values(raw).map((value) => {
    const c: StoredChunk = typeof value === "string" ? JSON.parse(value) : value;
    const vector = decode(c.emb);
    return { source: c.source, title: c.title, text: c.text, vector, norm: norm(vector) };
  });
  globalForRag.ragMemo = { buildId: meta.buildId, chunks };
  return chunks;
}

export type Retrieved = { source: string; title: string; text: string; score: number };

export async function search(meta: IndexMeta, question: string, k: number): Promise<Retrieved[]> {
  const chunks = await loadChunks(meta);
  if (!chunks.length) return [];
  const q = await embedQuery(question);
  const qNorm = norm(q) || 1;
  return chunks
    .map((c) => {
      let dot = 0;
      for (let i = 0; i < q.length; i++) dot += q[i] * c.vector[i];
      return { source: c.source, title: c.title, text: c.text, score: dot / (qNorm * (c.norm || 1)) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Index à utiliser pour une question. NON BLOQUANT : si l'index est périmé
 * (contenu modifié) ou absent, une reconstruction est lancée APRÈS la réponse
 * (`after`) — dans la limite du verrou et de la fenêtre de 10 min — et
 * l'index actuel continue de servir. Absent → null (le chat répond 503).
 */
export async function ensureIndex(): Promise<IndexMeta | null> {
  const meta = await getIndexMeta();
  if (!meta || meta.stale) {
    after(async () => {
      try {
        await rebuildIndex();
      } catch (error) {
        console.error("rag: reconstruction en arrière-plan échouée", error);
      }
    });
  }
  return meta;
}
