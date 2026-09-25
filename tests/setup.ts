import { vi } from "vitest";

// `server-only` lève une erreur hors d'un bundle serveur Next. Les tests
// tournent côté Node, ce garde-fou n'a pas de sens ici.
vi.mock("server-only", () => ({}));

// unstable_cache exige le cache incrémental du runtime Next, absent ici : il
// lèverait, et site-config retomberait silencieusement sur les valeurs par
// défaut. Lecture directe à la place (le cache par étiquette est testé à part,
// dans tests/site-config.test.ts, avec son propre remplaçant).
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => fn,
}));
