import "server-only";
import sharp, { type OutputInfo } from "sharp";
import { getStorage, newStorageKey, type Storage } from "@/lib/server/storage";

// Pipeline d'upload, indépendant du support de stockage :
//   1. taille bornée (≤ 4 Mo : sous la limite de corps des fonctions Vercel) ;
//   2. type RÉEL déduit des premiers octets (magic bytes) — ni l'extension ni
//      le Content-Type déclaré ne font foi, et une déclaration qui contredit
//      le contenu est refusée comme falsifiée ;
//   3. décodage réel par sharp (un fichier qui n'est pas une image échoue) ;
//   4. ré-encodage WebP redimensionné : supprime EXIF/GPS et toute charge
//      cachée dans le fichier d'origine ;
//   5. nom aléatoire (UUID) : rien du nom d'origine n'est conservé.
// SVG refusé : c'est du XML exécutable (scripts), impossible à « nettoyer »
// de façon fiable.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 40_000_000; // bombe de décompression
const MAX_WIDTH = 2000;

type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

const SIGNATURES: Array<[ImageType, (b: Buffer) => boolean]> = [
  ["image/jpeg", (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["image/webp", (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP"],
  ["image/avif", (b) => b.subarray(4, 8).toString("latin1") === "ftyp" && /^avi[fs]$/.test(b.subarray(8, 12).toString("latin1"))],
];

export const ALLOWED_TYPES: ImageType[] = SIGNATURES.map(([type]) => type);

const SHARP_FORMATS: Record<ImageType, string[]> = {
  "image/jpeg": ["jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["heif"],
};

/** Type d'image déduit du contenu, `null` si ce n'est pas un format autorisé. */
export function detectImageType(bytes: Buffer): ImageType | null {
  return SIGNATURES.find(([, matches]) => matches(bytes))?.[0] ?? null;
}

export class UploadRejectedError extends Error {}

export type StoredImage = {
  /** Clé de stockage, à enregistrer dans Media.url. */
  key: string;
  /** URL publique calculée par le driver (jamais un chemin disque). */
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: "image/webp";
};

export async function processAndStoreImage(file: File, storage: Storage = getStorage()): Promise<StoredImage> {
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new UploadRejectedError("Fichier vide ou supérieur à 4 Mo.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  // Double contrôle : `file.size` est annoncé par le client multipart.
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadRejectedError("Fichier vide ou supérieur à 4 Mo.");
  }

  const realType = detectImageType(input);
  if (!realType) {
    throw new UploadRejectedError("Format non autorisé : seules les images JPEG, PNG, WebP et AVIF sont acceptées.");
  }
  if (file.type && file.type !== realType) {
    throw new UploadRejectedError("Le contenu du fichier ne correspond pas à son type déclaré.");
  }

  let output: { data: Buffer; info: OutputInfo };
  try {
    const image = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.format || !SHARP_FORMATS[realType].includes(meta.format)) {
      throw new UploadRejectedError("Format d'image incohérent.");
    }
    output = await image
      .rotate() // applique l'orientation EXIF avant de supprimer les métadonnées
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof UploadRejectedError) throw error;
    throw new UploadRejectedError("Image illisible ou corrompue.");
  }

  const key = newStorageKey("webp");
  await storage.put(key, output.data, "image/webp");

  return {
    key,
    url: storage.getUrl(key),
    width: output.info.width,
    height: output.info.height,
    sizeBytes: output.info.size,
    mimeType: "image/webp",
  };
}

export async function deleteStoredImage(key: string, storage: Storage = getStorage()): Promise<void> {
  await storage.delete(key);
}
