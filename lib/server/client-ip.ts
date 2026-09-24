import { isIP } from "node:net";

/**
 * IP du client pour le rate limiting — point d'entrée unique.
 *
 * Les headers x-real-ip / x-forwarded-for sont écrits par le client tant
 * qu'aucun proxy de confiance ne les réécrit : on ne les lit que si
 * TRUST_PROXY=true (ou automatiquement sur Vercel, qui les réécrit).
 *
 *  1. x-real-ip, s'il contient une IP valide ;
 *  2. sinon x-forwarded-for compté depuis la DROITE : l'élément ajouté par
 *     notre proxy de confiance (TRUST_PROXY_HOPS, défaut 1). Les éléments de
 *     gauche sont fournis par le client et falsifiables ;
 *  3. sinon repli "unidentified" : un compartiment unique partagé par tous
 *     les clients non identifiés (restrictif par construction).
 *
 * IPv6 : ramenée à son préfixe /64 (un abonné reçoit souvent un /64 entier et
 * pourrait sinon changer d'adresse à chaque requête).
 */

export const UNIDENTIFIED_CLIENT = "unidentified";

type Env = Record<string, string | undefined>;

const warned = globalThis as unknown as { clientIpProxyWarning?: boolean };

/** Réarme l'avertissement (tests uniquement). */
export function resetClientIpWarning() {
  warned.clientIpProxyWarning = false;
}

export function isProxyTrusted(env: Env = process.env): boolean {
  if (env.TRUST_PROXY === "true") return true;
  if (env.TRUST_PROXY === "false") return false;
  return env.VERCEL === "1"; // Vercel réécrit x-real-ip / x-forwarded-for
}

function warnIfUnconfigured(env: Env) {
  if (env.NODE_ENV !== "production" || env.TRUST_PROXY !== undefined || warned.clientIpProxyWarning) return;
  warned.clientIpProxyWarning = true;
  console.warn(
    env.VERCEL === "1"
      ? "[client-ip] TRUST_PROXY absent : confiance aux headers proxy activée automatiquement (VERCEL=1). Définissez TRUST_PROXY=true pour l'expliciter."
      : "[client-ip] TRUST_PROXY absent en production : headers proxy ignorés, tous les clients partagent la limite « unidentified ». Définissez TRUST_PROXY=true derrière un proxy de confiance."
  );
}

function hops(env: Env): number {
  const n = Number(env.TRUST_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 1;
}

/** Développe une IPv6 valide en 8 groupes numériques. */
function ipv6Groups(ip: string): number[] {
  let text = ip;
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/); // suffixe IPv4 embarqué
  if (dotted) {
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    text = `${text.slice(0, -dotted[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const missing = tail === undefined ? 0 : 8 - left.length - right.length;
  return [...left, ...Array(missing).fill("0"), ...right].map((g) => parseInt(g, 16));
}

/** Nettoie puis valide une IP ; renvoie sa forme normalisée ou null. */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value || value.length > 64) return null;

  const bracketed = value.match(/^\[([^\]]+)\](?::\d+)?$/); // [2001:db8::1]:443
  if (bracketed) value = bracketed[1];
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(":")); // 1.2.3.4:80
  value = value.replace(/%.+$/, ""); // identifiant de zone : fe80::1%eth0

  const version = isIP(value);
  if (version === 4) return value;
  if (version !== 6) return null;

  const groups = ipv6Groups(value.toLowerCase());
  // IPv4 mappée (::ffff:a.b.c.d) : c'est en réalité une IPv4.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

export function getClientIp(headers: Headers, env: Env = process.env): string {
  warnIfUnconfigured(env);
  if (!isProxyTrusted(env)) return UNIDENTIFIED_CLIENT;

  const realIp = normalizeIp(headers.get("x-real-ip"));
  if (realIp) return realIp;

  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const fromRight = chain[chain.length - hops(env)];
  return normalizeIp(fromRight) ?? UNIDENTIFIED_CLIENT;
}
