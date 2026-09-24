import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { MAX_UPLOAD_BYTES, UploadRejectedError, detectImageType, processAndStoreImage } from "@/lib/server/media";
import { createLocalStorage } from "@/lib/server/storage/local";
import { createVercelBlobStorage } from "@/lib/server/storage/vercel-blob";
import { getStorage, isStorageKey } from "@/lib/server/storage";
import type { Storage } from "@/lib/server/storage/types";

// Client Vercel Blob simulé : aucun appel réseau.
const blob = vi.hoisted(() => ({ put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => blob);

const UUID_WEBP = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;

/** Stockage en mémoire : isole la validation du support réel. */
function memoryStorage() {
  const objects = new Map<string, Buffer>();
  const storage: Storage = {
    driver: "local",
    put: vi.fn(async (key: string, data: Buffer) => void objects.set(key, data)),
    get: async (key) => objects.get(key) ?? null,
    delete: async (key) => void objects.delete(key),
    getUrl: (key) => `/media/${key}`,
  };
  return { storage, objects };
}

const png = () => sharp({ create: { width: 40, height: 30, channels: 3, background: "#e0421c" } }).png().toBuffer();
const jpeg = () => sharp({ create: { width: 40, height: 30, channels: 3, background: "#211a12" } }).jpeg().toBuffer();
const asFile = (bytes: Buffer, type: string, name: string) => new File([new Uint8Array(bytes)], name, { type });

async function expectRejected(promise: Promise<unknown>, message: RegExp) {
  await expect(promise).rejects.toBeInstanceOf(UploadRejectedError);
  await expect(promise).rejects.toThrow(message);
}

describe("upload — taille maximale (4 Mo)", () => {
  it("refuse un fichier de 4 Mo + 1 octet, sans rien écrire", async () => {
    const { storage, objects } = memoryStorage();
    const header = await png(); // en-tête PNG valide : seule la taille doit faire échouer
    const big = Buffer.concat([header, Buffer.alloc(MAX_UPLOAD_BYTES + 1 - header.length)]);
    expect(big.length).toBe(MAX_UPLOAD_BYTES + 1);

    await expectRejected(processAndStoreImage(asFile(big, "image/png", "big.png"), storage), /4 Mo/);
    expect(storage.put).not.toHaveBeenCalled();
    expect(objects.size).toBe(0);
  });

  it("refuse un fichier vide", async () => {
    const { storage } = memoryStorage();
    await expectRejected(processAndStoreImage(asFile(Buffer.alloc(0), "image/png", "vide.png"), storage), /4 Mo/);
  });

  it("la limite reste sous le plafond de corps des fonctions Vercel (~4,5 Mo)", () => {
    expect(MAX_UPLOAD_BYTES).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
});

describe("upload — type réel (magic bytes), pas l'extension ni le Content-Type", () => {
  it("détecte le type à partir du contenu", async () => {
    expect(detectImageType(await png())).toBe("image/png");
    expect(detectImageType(await jpeg())).toBe("image/jpeg");
    expect(detectImageType(Buffer.from("<?php echo 1; ?>"))).toBeNull();
  });

  it("refuse un script déguisé en PNG (extension + Content-Type falsifiés)", async () => {
    const { storage } = memoryStorage();
    const fake = asFile(Buffer.from("<?php system($_GET['c']); ?>"), "image/png", "photo.png");
    await expectRejected(processAndStoreImage(fake, storage), /Format non autorisé/);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("refuse un vrai JPEG déclaré comme PNG (déclaration contredite par le contenu)", async () => {
    const { storage } = memoryStorage();
    const lying = asFile(await jpeg(), "image/png", "photo.png");
    await expectRejected(processAndStoreImage(lying, storage), /ne correspond pas/);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("refuse un SVG, même déclaré comme image", async () => {
    const { storage } = memoryStorage();
    const svg = asFile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "image/svg+xml", "x.svg");
    await expectRejected(processAndStoreImage(svg, storage), /Format non autorisé/);
  });

  it("refuse une signature PNG suivie de données corrompues", async () => {
    const { storage } = memoryStorage();
    const header = (await png()).subarray(0, 8);
    const corrupt = asFile(Buffer.concat([header, Buffer.from("pas une image")]), "image/png", "x.png");
    await expectRejected(processAndStoreImage(corrupt, storage), /illisible|incohérent/);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("accepte une vraie image même sans Content-Type (seul le contenu fait foi)", async () => {
    const { storage } = memoryStorage();
    const stored = await processAndStoreImage(asFile(await png(), "", "sans-type"), storage);
    expect(stored.mimeType).toBe("image/webp");
  });
});

describe("upload — nom aléatoire, chemin disque jamais exposé", () => {
  it("génère une clé UUID .webp, différente à chaque upload, sans rien du nom d'origine", async () => {
    const { storage, objects } = memoryStorage();
    const bytes = await png();
    const hostile = "../../etc/passwd; rm -rf .png";

    const a = await processAndStoreImage(asFile(bytes, "image/png", hostile), storage);
    const b = await processAndStoreImage(asFile(bytes, "image/png", hostile), storage);

    expect(a.key).toMatch(UUID_WEBP);
    expect(b.key).toMatch(UUID_WEBP);
    expect(a.key).not.toBe(b.key);
    for (const fragment of ["passwd", "etc", "..", "/", "rm", "png"]) expect(a.key).not.toContain(fragment);
    expect([...objects.keys()].sort()).toEqual([a.key, b.key].sort());
    // Le fichier stocké est bien le WebP ré-encodé, pas l'original.
    expect(detectImageType(objects.get(a.key)!)).toBe("image/webp");
  });

  it("le driver local n'expose que /media/<clé>, jamais le dossier sur disque", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pcp-storage-"));
    try {
      const storage = createLocalStorage(dir);
      const stored = await processAndStoreImage(asFile(await png(), "image/png", "photo.png"), storage);

      expect(stored.url).toBe(`/media/${stored.key}`);
      expect(stored.url).not.toContain(dir);
      expect(stored.url).not.toContain(os.tmpdir());
      expect(JSON.stringify(stored)).not.toContain(dir.replaceAll("\\", "\\\\"));
      expect(await readdir(dir)).toEqual([stored.key]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("driver local", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "pcp-storage-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("put / get / delete aller-retour, sans écrasement", async () => {
    const storage = createLocalStorage(dir);
    const key = `${crypto.randomUUID()}.webp`;
    await storage.put(key, Buffer.from("abc"), "image/webp");
    expect((await storage.get(key))?.toString()).toBe("abc");
    await expect(storage.put(key, Buffer.from("xyz"), "image/webp")).rejects.toThrow();
    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it("refuse toute clé hors format (traversée de répertoire)", async () => {
    const storage = createLocalStorage(dir);
    await expect(storage.put("../evil.webp", Buffer.from("x"), "image/webp")).rejects.toThrow(/Clé/);
    expect(await storage.get("../../.env")).toBeNull();
    expect(() => storage.getUrl("../../.env")).toThrow(/Clé/);
    expect(isStorageKey("..%2F.env")).toBe(false);
  });
});

describe("driver vercel-blob (client simulé)", () => {
  beforeEach(() => {
    blob.put.mockReset().mockResolvedValue({});
    blob.del.mockReset().mockResolvedValue(undefined);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_AbCd1234_secretpart");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("envoie en accès public sous media/<clé>, sans suffixe ni écrasement", async () => {
    const storage = createVercelBlobStorage();
    const stored = await processAndStoreImage(asFile(await png(), "image/png", "photo.png"), storage);

    expect(blob.put).toHaveBeenCalledTimes(1);
    const [pathname, body, options] = blob.put.mock.calls[0];
    expect(pathname).toBe(`media/${stored.key}`);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(options).toMatchObject({
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "image/webp",
      token: "vercel_blob_rw_AbCd1234_secretpart",
    });
  });

  it("calcule l'URL CDN publique à partir du store, sans appel réseau", () => {
    const storage = createVercelBlobStorage();
    const key = `${crypto.randomUUID()}.webp`;
    expect(storage.getUrl(key)).toBe(`https://abcd1234.public.blob.vercel-storage.com/media/${key}`);
    expect(blob.put).not.toHaveBeenCalled();
  });

  it("supprime par URL, et échoue clairement sans jeton", async () => {
    const key = `${crypto.randomUUID()}.webp`;
    await createVercelBlobStorage().delete(key);
    expect(blob.del).toHaveBeenCalledWith(`https://abcd1234.public.blob.vercel-storage.com/media/${key}`, {
      token: "vercel_blob_rw_AbCd1234_secretpart",
    });

    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    await expect(createVercelBlobStorage().put(key, Buffer.from("x"), "image/webp")).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});

describe("sélection du driver (STORAGE_DRIVER)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    (globalThis as { storage?: unknown }).storage = undefined;
  });

  it("local par défaut, vercel-blob sur demande, refus d'une valeur inconnue", () => {
    vi.stubEnv("STORAGE_DRIVER", undefined as unknown as string);
    delete process.env.STORAGE_DRIVER;
    expect(getStorage().driver).toBe("local");

    vi.stubEnv("STORAGE_DRIVER", "vercel-blob");
    expect(getStorage().driver).toBe("vercel-blob");

    vi.stubEnv("STORAGE_DRIVER", "s3");
    expect(() => getStorage()).toThrow(/STORAGE_DRIVER inconnu/);
  });
});
