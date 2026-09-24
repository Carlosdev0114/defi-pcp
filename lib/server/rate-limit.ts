import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { getRedis } from "@/lib/server/redis";
import { apiError } from "@/lib/server/api";

// Fenêtres glissantes stockées dans Redis, partagées entre toutes les
// instances serverless (contrairement à un compteur en mémoire).
const RULES = {
  // Login : par IP (balayage de comptes) et par e-mail (protège un compte
  // même si l'attaquant fait tourner ses IP ou falsifie x-forwarded-for).
  loginIp: { tokens: 20, window: "10 m" },
  loginEmail: { tokens: 5, window: "10 m" },
  // Chatbot : rafale courte + plafond quotidien (coût des appels Gemini).
  chatBurst: { tokens: 5, window: "30 s" },
  chatDaily: { tokens: 60, window: "1 d" },
  // Chatbot, toutes IP confondues : plafond sous le quota gratuit Gemini
  // (~10 req/min). Des IP changeantes ne peuvent pas épuiser le quota.
  // Valeur réelle lue dans CHAT_GLOBAL_PER_MINUTE (voir ruleFor).
  chatGlobal: { tokens: 8, window: "1 m" },
  // Formulaire de contact et prise de RDV : anti-spam.
  contact: { tokens: 3, window: "10 m" },
  booking: { tokens: 5, window: "10 m" },
  // Messagerie visiteur : ouverture de conversation par IP, envoi par IP ET
  // par conversation (un cookie ne contourne pas la limite en changeant d'IP).
  conversationStart: { tokens: 3, window: "1 h" },
  messageIp: { tokens: 10, window: "1 m" },
  messageConversation: { tokens: 30, window: "10 m" },
  // Comptage des visites : plafond GLOBAL (clé unique, aucune IP stockée).
  visitGlobal: { tokens: 600, window: "1 m" },
} satisfies Record<string, { tokens: number; window: Duration }>;

type RuleName = keyof typeof RULES;

/** Clé unique des limites globales (chat, visites) : jamais une IP. */
export const CHAT_GLOBAL_KEY = "all";
export const GLOBAL_KEY = "all";

function ruleFor(name: RuleName): { tokens: number; window: Duration } {
  if (name === "chatGlobal") {
    const n = Number(process.env.CHAT_GLOBAL_PER_MINUTE);
    if (Number.isInteger(n) && n >= 1) return { ...RULES.chatGlobal, tokens: n };
  }
  return RULES[name];
}

const globalForLimits = globalThis as unknown as {
  limiters?: Partial<Record<RuleName, Ratelimit>>;
};

function limiter(name: RuleName): Ratelimit {
  const cache = (globalForLimits.limiters ??= {});
  const existing = cache[name];
  if (existing) return existing;
  const rule = ruleFor(name);
  const created = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(rule.tokens, rule.window),
    prefix: `rl:${name}`,
  });
  cache[name] = created;
  return created;
}

export type RateLimitResult = { success: boolean; reset: number };

/** Applique plusieurs règles ; échoue dès qu'une seule est dépassée. */
export async function checkLimits(
  checks: Array<[RuleName, string]>
): Promise<RateLimitResult> {
  const results = await Promise.all(checks.map(([name, key]) => limiter(name).limit(key)));
  const blocked = results.filter((r) => !r.success);
  if (blocked.length) {
    return { success: false, reset: Math.max(...blocked.map((r) => r.reset)) };
  }
  return { success: true, reset: 0 };
}

export function tooManyRequests(reset: number) {
  const retryIn = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  const response = apiError(`Trop de tentatives. Réessayez dans ${retryIn} s.`, 429);
  response.headers.set("Retry-After", String(retryIn));
  return response;
}

export function limitLogin(ip: string, email: string) {
  return checkLimits([
    ["loginIp", ip],
    ["loginEmail", email],
  ]);
}
