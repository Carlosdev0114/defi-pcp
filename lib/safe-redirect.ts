// Validation des cibles de redirection venant de l'extérieur (paramètre
// `?next=`). Module sans dépendance serveur : utilisable côté client comme
// côté serveur — c'est le seul endroit où cette logique existe.
//
// Accepté : uniquement un chemin interne relatif à la racine du site
// ("/admin/projets?x=1#y"). Tout le reste retombe sur `fallback`.

export const DEFAULT_REDIRECT = "/admin";

const MAX_LENGTH = 2048;
const MAX_DECODE_PASSES = 3;

/** Forme dangereuse, quelle que soit la couche de décodage où elle apparaît. */
function isUnsafe(value: string): boolean {
  return (
    value.length > MAX_LENGTH ||
    // Caractères de contrôle (dont \t \n \r, que les navigateurs suppriment
    // des URL : "/\t/evil.com" deviendrait "//evil.com") et DEL.
    /[\u0000-\u001f\u007f]/.test(value) ||
    // Espaces en tête : "  //evil.com" ou " https://…".
    /^\s/.test(value) ||
    // Un seul "/" en tête. "//hote" et "/\hote" sont des URL
    // relatives au protocole (les navigateurs lisent "\" comme "/").
    !value.startsWith("/") ||
    value[1] === "/" ||
    // Aucun antislash nulle part (normalisé en "/" par les navigateurs).
    value.includes("\\")
  );
}

export function safeRedirectPath(raw: string | null | undefined, fallback: string = DEFAULT_REDIRECT): string {
  if (typeof raw !== "string" || raw === "") return fallback;

  // Contrôle de la valeur brute ET de ses formes décodées (%2f%2f, %5c,
  // double encodage %252f…) : un décodage ultérieur ne doit rien révéler.
  let layer = raw;
  for (let pass = 0; pass <= MAX_DECODE_PASSES; pass++) {
    if (isUnsafe(layer)) return fallback;
    let decoded: string;
    try {
      decoded = decodeURIComponent(layer);
    } catch {
      return fallback; // encodage malformé
    }
    if (decoded === layer) break;
    if (pass === MAX_DECODE_PASSES) return fallback; // encodage trop imbriqué
    layer = decoded;
  }

  // Défense en profondeur : résolue contre une origine fictive, la cible
  // doit rester sur cette origine (aucun schéma, hôte ni identifiants).
  const base = "http://redirect.invalid";
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
