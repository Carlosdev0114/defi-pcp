import "server-only";
// Appels REST à l'API Gemini. Strictement côté serveur : la clé est lue dans
// l'environnement et n'est jamais exposée (pas de préfixe NEXT_PUBLIC_).

const API = "https://generativelanguage.googleapis.com/v1beta";
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
export const EMBEDDING_DIMS = 768;
const CHAT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const TIMEOUT_MS = 20_000;
const BATCH = 100;

export class GeminiUnavailableError extends Error {}
/** Quota Gemini dépassé (HTTP 429) : situation transitoire, pas une panne. */
export class GeminiQuotaError extends Error {}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiUnavailableError("GEMINI_API_KEY manquant.");
  return key;
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    // Le corps d'erreur Google peut être verbeux : on n'en garde qu'un extrait
    // pour les logs serveur ; il ne remonte jamais au client.
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    const message = `Gemini ${path} → HTTP ${res.status}: ${detail}`;
    throw res.status === 429 ? new GeminiQuotaError(message) : new Error(message);
  }
  return (await res.json()) as T;
}

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export async function embedDocuments(docs: Array<{ title: string; text: string }>): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    const res = await call<{ embeddings: Array<{ values: number[] }> }>(
      `models/${EMBEDDING_MODEL}:batchEmbedContents`,
      {
        requests: batch.map((d) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: d.text }] },
          taskType: "RETRIEVAL_DOCUMENT" satisfies TaskType,
          title: d.title,
          outputDimensionality: EMBEDDING_DIMS,
        })),
      }
    );
    out.push(...res.embeddings.map((e) => e.values));
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const res = await call<{ embedding: { values: number[] } }>(
    `models/${EMBEDDING_MODEL}:embedContent`,
    {
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_QUERY" satisfies TaskType,
      outputDimensionality: EMBEDDING_DIMS,
    }
  );
  return res.embedding.values;
}

type GenerateResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
};

export async function generate(systemInstruction: string, userText: string, temperature = 0.2): Promise<string> {
  const res = await call<GenerateResponse>(`models/${CHAT_MODEL}:generateContent`, {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 600,
      // Les modèles « flash » réfléchissent par défaut et ces tokens sont
      // décomptés de maxOutputTokens : inutile pour reformuler des extraits,
      // et ça peut tronquer la réponse. Désactivé.
      ...(CHAT_MODEL.includes("flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  });
  return (res.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}
