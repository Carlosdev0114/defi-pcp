// Redis en mémoire, limité aux commandes utilisées par realtime.ts et
// visits.ts. Permet de tester le vrai code et d'inspecter les clés écrites.

type Value = number | string | Record<string, number>;

export function createFakeRedis() {
  const store = new Map<string, Value>();
  let failWrites = false;
  const commands: string[] = [];

  const ensureWritable = () => {
    if (failWrites) throw new Error("Redis indisponible (simulé)");
  };

  const api = {
    store,
    commands,
    /** Fait échouer toutes les écritures (test du best-effort). */
    failWrites(value: boolean) {
      failWrites = value;
    },
    async get(key: string) {
      commands.push(`GET ${key}`);
      return store.has(key) ? store.get(key) : null;
    },
    async incr(key: string) {
      commands.push(`INCR ${key}`);
      ensureWritable();
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },
    async expire(key: string) {
      commands.push(`EXPIRE ${key}`);
      ensureWritable();
      return 1;
    },
    async hincrby(key: string, field: string, by: number) {
      commands.push(`HINCRBY ${key} ${field}`);
      ensureWritable();
      const hash = (store.get(key) as Record<string, number>) ?? {};
      hash[field] = (hash[field] ?? 0) + by;
      store.set(key, hash);
      return hash[field];
    },
    async hgetall(key: string) {
      commands.push(`HGETALL ${key}`);
      return (store.get(key) as Record<string, number>) ?? null;
    },
    async mget(...keys: string[]) {
      commands.push(`MGET ${keys.length}`);
      return keys.map((k) => store.get(k) ?? null);
    },
    pipeline() {
      const queued: (() => Promise<unknown>)[] = [];
      const p = {
        incr: (k: string) => (queued.push(() => api.incr(k)), p),
        expire: (k: string) => (queued.push(() => api.expire(k)), p),
        hincrby: (k: string, f: string, by: number) => (queued.push(() => api.hincrby(k, f, by)), p),
        hgetall: (k: string) => (queued.push(() => api.hgetall(k)), p),
        exec: async () => {
          const out: unknown[] = [];
          for (const q of queued) out.push(await q());
          return out;
        },
      };
      return p;
    },
  };
  return api;
}

export type FakeRedis = ReturnType<typeof createFakeRedis>;
