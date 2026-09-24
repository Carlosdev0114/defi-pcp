import { NextRequest, NextResponse } from "next/server";
import { withErrors, parseJsonBody, apiError } from "@/lib/server/api";
import { getClientIp } from "@/lib/server/client-ip";
import { chatSchema } from "@/lib/server/validation";
import { checkLimits, tooManyRequests, CHAT_GLOBAL_KEY } from "@/lib/server/rate-limit";
import { answerQuestion } from "@/lib/server/rag/chat";
import { isGeminiConfigured, GeminiQuotaError } from "@/lib/server/rag/gemini";
import { getModules } from "@/lib/server/site-config";

/** Réponse « assistant saturé », identique que la saturation vienne de notre
 * limite globale ou d'un 429 de Gemini : le client n'a pas à distinguer. */
function assistantBusy() {
  const response = apiError("L'assistant est très sollicité, réessayez dans une minute.", 503);
  response.headers.set("Retry-After", "60");
  return response;
}

/** Chatbot RAG : validation Zod → rate limiting Redis (par IP, puis global)
 * → recherche vectorielle dans les données publiques → Gemini avec le seul
 * contexte récupéré. */
export function POST(req: NextRequest) {
  return withErrors("POST /api/chat", async () => {
    const { data, error } = await parseJsonBody(req, chatSchema, 4 * 1024);
    if (error) return error;

    // 1. Limite par IP d'abord : une requête déjà refusée ici ne consomme
    //    pas le budget global partagé.
    const ip = getClientIp(req.headers);
    const perIp = await checkLimits([
      ["chatBurst", ip],
      ["chatDaily", ip],
    ]);
    if (!perIp.success) return tooManyRequests(perIp.reset);

    // 2. Limite globale, toutes IP confondues, sous le quota Gemini.
    const global = await checkLimits([["chatGlobal", CHAT_GLOBAL_KEY]]);
    if (!global.success) {
      console.warn("POST /api/chat: limite globale atteinte");
      return assistantBusy();
    }

    if (!isGeminiConfigured() || !(await getModules()).chat) {
      return apiError("L'assistant est momentanément indisponible.", 503);
    }

    try {
      const outcome = await answerQuestion(data.question);
      if (outcome.status === "indexing") {
        return apiError("L'assistant prépare ses connaissances, réessayez dans une minute.", 503);
      }
      return NextResponse.json(outcome.result);
    } catch (err) {
      if (err instanceof GeminiQuotaError) {
        console.warn("POST /api/chat: quota Gemini atteint");
        return assistantBusy();
      }
      throw err;
    }
  });
}
