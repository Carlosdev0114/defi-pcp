import { beforeEach, describe, expect, it, vi } from "vitest";

// La base de connaissances ne doit indexer que du contenu PUBLIÉ : jamais un
// brouillon (publishedAt null) ni un contenu à publication future (publishedAt
// > maintenant). Le mock de Prisma ci-dessous rejoue fidèlement le WHERE reçu :
// les brouillons de la « base » ne peuvent donc remonter dans les documents que
// si loadKnowledge omettait réellement son filtre publishedNow().

type PublishWhere = { publishedAt?: { not?: null; lte?: Date; gt?: Date } };
type Row = { publishedAt: string | null; [field: string]: unknown };

const mocks = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const redis = {
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    set: async (k: string, v: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(k)) return null;
      store.set(k, v);
      return "OK";
    },
    del: async (...keys: string[]) => keys.filter((k) => store.delete(k)).length,
  };

  // publishedNow() = { publishedAt: { not: null, lte: maintenant } }.
  const passes = (row: Row, where?: PublishWhere) => {
    const cond = where?.publishedAt;
    if (!cond) return true;
    if (cond.not !== undefined && row.publishedAt === null) return false;
    if (cond.lte !== undefined && (row.publishedAt === null || new Date(row.publishedAt).getTime() > cond.lte.getTime())) return false;
    if (cond.gt !== undefined && (row.publishedAt === null || new Date(row.publishedAt).getTime() <= cond.gt.getTime())) return false;
    return true;
  };

  const projects: Row[] = [
    { id: "p1", slug: "projet-publie", title: "Projet publié", summary: "Résumé du projet publié", role: "Développeuse", techStack: ["Next.js"], description: "Description publiée.", liveUrl: "https://exemple.dev", publishedAt: "2026-09-01T00:00:00Z", order: 1 },
    { id: "p2", slug: "projet-brouillon", title: "Projet brouillon", summary: "Brouillon encore en rédaction", role: null, techStack: [], description: "Jamais publié.", liveUrl: null, publishedAt: null, order: 2 },
    { id: "p3", slug: "projet-futur", title: "Projet à venir", summary: "Publication programmée", role: null, techStack: [], description: "Pas encore visible.", liveUrl: null, publishedAt: "2999-01-01T00:00:00Z", order: 3 },
  ];
  const articles: Row[] = [
    { id: "a1", slug: "article-publie", title: "Article publié", excerpt: "Extrait publié", content: "Contenu publié.", publishedAt: "2026-09-02T00:00:00Z" },
    { id: "a2", slug: "article-brouillon", title: "Article brouillon", excerpt: "Extrait", content: "Brouillon.", publishedAt: null },
    { id: "a3", slug: "article-futur", title: "Article futur", excerpt: "Extrait", content: "Futur.", publishedAt: "2999-01-01T00:00:00Z" },
  ];

  const findRows = (rows: Row[]) =>
    vi.fn((args?: { where?: PublishWhere; orderBy?: unknown }) => rows.filter((r) => passes(r, args?.where)));

  const db = {
    project: { findMany: findRows(projects) },
    article: { findMany: findRows(articles) },
    experience: { findMany: async () => [] as Row[] },
    skill: { findMany: async () => [] as Row[] },
    service: { findMany: async () => [] as Row[] },
  };
  return { store, redis, db };
});

vi.mock("@/lib/server/redis", () => ({ getRedis: () => mocks.redis }));
vi.mock("@/lib/server/db", () => ({ db: mocks.db }));

/** Profil public en Redis, comme le lit getProfile (site-config). */
function seedProfile() {
  mocks.store.set("public:profile", {
    name: "Camille Test",
    role: "Développeuse web",
    baseline: "",
    shortBio: "",
    email: "",
    phone: "",
    location: "Paris",
    socials: { github: "", linkedin: "", mastodon: "" },
  });
}

beforeEach(async () => {
  mocks.store.clear();
  mocks.db.project.findMany.mockClear();
  mocks.db.article.findMany.mockClear();
  seedProfile();
});

describe("RAG — base de connaissances limitée au contenu publié", () => {
  it("indexe projets et articles publiés, jamais brouillons ni publications futures", async () => {
    const { loadKnowledge } = await import("@/lib/server/rag/knowledge");
    const docs = await loadKnowledge();

    const sources = docs.map((d) => d.source);
    expect(sources).toContain("projet:projet-publie");
    expect(sources).not.toContain("projet:projet-brouillon");
    expect(sources).not.toContain("projet:projet-futur");
    expect(sources).toContain("article:article-publie");
    expect(sources).not.toContain("article:article-brouillon");
    expect(sources).not.toContain("article:article-futur");
  });

  it("transmet à la base le filtre publishedNow() sur projets et articles", async () => {
    const { loadKnowledge } = await import("@/lib/server/rag/knowledge");
    await loadKnowledge();

    const projectArgs = mocks.db.project.findMany.mock.calls[0]?.[0];
    const articleArgs = mocks.db.article.findMany.mock.calls[0]?.[0];
    expect(projectArgs?.where).toEqual({ publishedAt: { not: null, lte: expect.any(Date) } });
    expect(articleArgs?.where).toEqual({ publishedAt: { not: null, lte: expect.any(Date) } });
  });
});