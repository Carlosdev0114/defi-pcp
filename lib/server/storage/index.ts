import "server-only";
import { createLocalStorage } from "@/lib/server/storage/local";
import { createVercelBlobStorage } from "@/lib/server/storage/vercel-blob";
import type { Storage, StorageDriver } from "@/lib/server/storage/types";

export { isStorageKey, newStorageKey, type Storage, type StorageDriver } from "@/lib/server/storage/types";

/** Driver choisi par STORAGE_DRIVER : `local` (défaut, dev) ou `vercel-blob`. */
export function storageDriver(): StorageDriver {
  const value = process.env.STORAGE_DRIVER ?? "local";
  if (value === "local" || value === "vercel-blob") return value;
  throw new Error(`STORAGE_DRIVER inconnu : « ${value} » (attendu : local | vercel-blob).`);
}

const globalForStorage = globalThis as unknown as { storage?: Storage };

export function getStorage(): Storage {
  const driver = storageDriver();
  if (globalForStorage.storage?.driver === driver) return globalForStorage.storage;
  globalForStorage.storage = driver === "vercel-blob" ? createVercelBlobStorage() : createLocalStorage();
  return globalForStorage.storage;
}

/** Media.url contient la clé de stockage ; l'URL publique est calculée ici. */
export function mediaUrl(key: string): string {
  return getStorage().getUrl(key);
}

/** Remplace la clé par l'URL publique dans un objet Media (ou null). */
export function withMediaUrl<T extends { url: string }>(media: T): T;
export function withMediaUrl<T extends { url: string }>(media: T | null): T | null;
export function withMediaUrl<T extends { url: string }>(media: T | null): T | null {
  return media ? { ...media, url: mediaUrl(media.url) } : null;
}
