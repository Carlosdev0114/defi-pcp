import { del, put } from "@vercel/blob";
import { assertStorageKey, isStorageKey, type Storage } from "@/lib/server/storage/types";

// Driver de production : Vercel Blob en accès public. Les images sont servies
// directement par le CDN Blob (aucun temps de fonction consommé à l'affichage).
// Les objets sont rangés sous le préfixe `media/`.

const PREFIX = "media/";
const CACHE_SECONDS = 60 * 60 * 24 * 365; // clés immuables (UUID) → cache long

/** Jeton lu à chaque appel : jamais figé au chargement du module. */
function token(): string {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error("BLOB_READ_WRITE_TOKEN manquant pour STORAGE_DRIVER=vercel-blob.");
  return value;
}

/**
 * Base publique du store : https://<storeId>.public.blob.vercel-storage.com.
 * L'identifiant est le 4ᵉ segment du jeton `vercel_blob_rw_<storeId>_<secret>`
 * (même règle que le SDK). BLOB_PUBLIC_BASE_URL permet de la forcer.
 */
export function blobPublicBaseUrl(): string {
  const override = process.env.BLOB_PUBLIC_BASE_URL;
  if (override) return override.replace(/\/+$/, "");
  const storeId = token().split("_")[3];
  if (!storeId) throw new Error("BLOB_READ_WRITE_TOKEN ne contient pas d'identifiant de store.");
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
}

export function createVercelBlobStorage(): Storage {
  const getUrl = (key: string) => {
    assertStorageKey(key);
    return `${blobPublicBaseUrl()}/${PREFIX}${key}`;
  };

  return {
    driver: "vercel-blob",

    async put(key, data, contentType) {
      assertStorageKey(key);
      await put(`${PREFIX}${key}`, data, {
        access: "public",
        addRandomSuffix: false, // la clé est déjà aléatoire et doit rester stable
        allowOverwrite: false,
        contentType,
        cacheControlMaxAge: CACHE_SECONDS,
        token: token(),
      });
    },

    async get(key) {
      if (!isStorageKey(key)) return null;
      const res = await fetch(getUrl(key), { cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Lecture Blob impossible (HTTP ${res.status}).`);
      return Buffer.from(await res.arrayBuffer());
    },

    async delete(key) {
      if (!isStorageKey(key)) return;
      await del(getUrl(key), { token: token() });
    },

    getUrl,
  };
}
