import { NextRequest, NextResponse } from "next/server";
import { withAdmin, apiError, parseJsonBody } from "@/lib/server/api";
import { chatSchema } from "@/lib/server/validation";
import { checkLimits, CHAT_GLOBAL_KEY } from "@/lib/server/rate-limit";
import { answerQuestion } from "@/lib/server/rag/chat";
import { isGeminiConfigured, GeminiQuotaError } from "@/lib/server/rag/gemini";

function busy() {
  const response = apiError("L'assistant est très sollicité, réessayez dans une minute.", 503);
  response.headers.set("Retry-After", "60");
  return response;
}

/**
 * Test réel de l'assistant depuis l'admin (même moteur que /api/chat, avec
 * les réglages enregistrés). Compte dans la limite globale du chat : un test
 * ne peut pas épuiser le quota Gemini plus vite que les visiteurs.
 */
export function POST(req: NextRequest) {
  return withAdmin("POST /api/admin/assistant/test", async () => {
    const { data, error } = await parseJsonBody(req, chatSchema, 4 * 1024);
    if (error) return error;
    if (!isGeminiConfigured()) return apiError("GEMINI_API_KEY n'est pas configurée sur le serveur.", 503);
    if (!(await checkLimits([["chatGlobal", CHAT_GLOBAL_KEY]])).success) return busy();
    try {
      const outcome = await answerQuestion(data.question);
      if (outcome.status === "indexing") return apiError("L'index est en cours de construction, réessayez dans une minute.", 503);
      return NextResponse.json(outcome.result);
    } catch (err) {
      if (err instanceof GeminiQuotaError) return busy();
      throw err;
    }
  });
}
