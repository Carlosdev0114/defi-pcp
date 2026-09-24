import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, apiError, parseJsonBody } from "@/lib/server/api";
import { getIndexMeta, rebuildCooldownSeconds, rebuildIndex } from "@/lib/server/rag/index";
import { isGeminiConfigured, GeminiQuotaError } from "@/lib/server/rag/gemini";
import { getAssistantConfig, getModules, setAssistantConfig } from "@/lib/server/site-config";
import { assistantSchema } from "@/lib/schemas/site";

/** État de la base de connaissances et réglages de l'assistant. */
export function GET() {
  return withAdmin("GET /api/admin/assistant", async () => {
    const [index, config, modules, cooldown] = await Promise.all([getIndexMeta(), getAssistantConfig(), getModules(), rebuildCooldownSeconds()]);
    return NextResponse.json({ configured: isGeminiConfigured(), enabled: modules.chat, index, config, rebuildCooldownSeconds: cooldown });
  });
}

/** Réglages (température, extraits, consignes). Les règles anti-injection restent dans le code. */
export function PUT(req: NextRequest) {
  return withAdmin("PUT /api/admin/assistant", async (admin) => {
    const { data, error } = await parseJsonBody(req, assistantSchema);
    if (error) return error;
    const config = await setAssistantConfig(data);
    await db.activity.create({ data: { userId: admin.id, action: "assistant.config", entity: "assistant" } });
    return NextResponse.json({ config });
  });
}

/** Reconstruit l'index à la demande, dans les mêmes limites que le chatbot
 * (une à la fois, au plus une toutes les 10 min). */
export function POST() {
  return withAdmin("POST /api/admin/assistant", async (admin) => {
    if (!isGeminiConfigured()) return apiError("GEMINI_API_KEY n'est pas configurée sur le serveur.", 503);
    let result;
    try {
      result = await rebuildIndex();
    } catch (err) {
      if (err instanceof GeminiQuotaError) {
        const response = apiError("Quota Gemini atteint, réessayez dans une minute.", 503);
        response.headers.set("Retry-After", "60");
        return response;
      }
      throw err;
    }
    if (result.status === "running") return apiError("Une reconstruction est déjà en cours.", 409);
    if (result.status === "cooldown") {
      const response = apiError(`Reconstruction possible dans ${Math.ceil(result.retryInSeconds / 60)} min (une toutes les 10 min, quota Gemini).`, 429);
      response.headers.set("Retry-After", String(result.retryInSeconds));
      return response;
    }
    // Pas de transaction : l'index vit dans Redis, seule cette ligne d'audit va en base.
    await db.activity.create({
      data: { userId: admin.id, action: "assistant.reindex", entity: "assistant", entityId: result.meta.buildId },
    });
    return NextResponse.json({ index: result.meta });
  });
}
