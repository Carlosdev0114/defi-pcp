import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertStorageKey, isStorageKey, type Storage } from "@/lib/server/storage/types";

// Driver de développement : fichiers dans UPLOAD_DIR (défaut ./uploads, hors
// de public/ qui n'est lu qu'au build), servis par la route /media/[file].
// Chemins exclus du traçage Turbopack : données créées à l'exécution.

export function localStorageDir(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads")
  );
}

function filePath(dir: string, key: string) {
  assertStorageKey(key);
  return path.join(/*turbopackIgnore: true*/ dir, key);
}

export function createLocalStorage(dir = localStorageDir()): Storage {
  return {
    driver: "local",

    async put(key, data) {
      const target = filePath(dir, key);
      await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
      await writeFile(target, data, { flag: "wx" }); // wx : jamais d'écrasement
    },

    async get(key) {
      if (!isStorageKey(key)) return null;
      try {
        return await readFile(filePath(dir, key));
      } catch {
        return null;
      }
    },

    async delete(key) {
      if (!isStorageKey(key)) return;
      await unlink(filePath(dir, key)).catch(() => undefined);
    },

    getUrl(key) {
      assertStorageKey(key);
      return `/media/${key}`;
    },
  };
}
