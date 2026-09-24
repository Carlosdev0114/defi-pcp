/**
 * Stockage objet des médias, indépendant du support. Le code applicatif ne
 * manipule que des **clés** (nom aléatoire généré par `newStorageKey`) :
 * jamais de chemin disque ni d'URL de stockage en base. L'URL publique est
 * recalculée à la lecture via `getUrl`, ce qui permet de changer de driver
 * sans réécrire la base.
 */
export interface Storage {
  readonly driver: StorageDriver;
  /** Écrit un objet. Échoue si la clé existe déjà (pas d'écrasement). */
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Lit un objet, `null` s'il n'existe pas. */
  get(key: string): Promise<Buffer | null>;
  /** Supprime un objet ; sans effet s'il n'existe pas. */
  delete(key: string): Promise<void>;
  /** URL publique de l'objet (calculée, sans appel réseau). */
  getUrl(key: string): string;
}

export type StorageDriver = "local" | "vercel-blob";

// Clé = UUID v4 + extension. Format strict : aucune traversée de répertoire
// possible, et rien du nom de fichier d'origine n'est conservé.
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp)$/;

export function isStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function assertStorageKey(key: string): void {
  if (!isStorageKey(key)) throw new Error("Clé de stockage invalide.");
}

export function newStorageKey(extension: "webp"): string {
  return `${crypto.randomUUID()}.${extension}`;
}
