import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseQuery, paginationSchema, paginated, toSkipTake, apiError } from "@/lib/server/api";
import { MAX_UPLOAD_BYTES, processAndStoreImage, deleteStoredImage, UploadRejectedError } from "@/lib/server/media";
import { withMediaUrl } from "@/lib/server/storage";
import { logActivity } from "@/lib/server/audit";

export function GET(req: NextRequest) {
  return withAdmin("GET /api/admin/media", async () => {
    const { data: page, error } = parseQuery(req, paginationSchema);
    if (error) return error;
    const [items, total] = await db.$transaction([
      db.media.findMany({ orderBy: { createdAt: "desc" }, ...toSkipTake(page) }),
      db.media.count(),
    ]);
    return NextResponse.json(paginated(items.map((m) => withMediaUrl(m)), total, page));
  });
}

export function POST(req: NextRequest) {
  return withAdmin("POST /api/admin/media", async (admin) => {
    if (!req.headers.get("content-type")?.includes("multipart/form-data")) {
      return apiError("Content-Type multipart/form-data attendu.", 415);
    }
    // Refus avant lecture du corps si la taille annoncée dépasse la limite
    // (marge pour l'enveloppe multipart).
    if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) {
      return apiError("Fichier supérieur à 4 Mo.", 413);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return apiError("Formulaire illisible.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("Champ `file` manquant.", 400);
    const altRaw = form.get("altText");
    const altText = typeof altRaw === "string" ? altRaw.trim().slice(0, 200) || null : null;

    let stored;
    try {
      stored = await processAndStoreImage(file);
    } catch (err) {
      if (err instanceof UploadRejectedError) return apiError(err.message, 422);
      throw err;
    }

    try {
      const media = await db.$transaction(async (tx) => {
        const created = await tx.media.create({
          data: {
            url: stored.key, // clé de stockage ; l'URL est calculée à la lecture
            mimeType: stored.mimeType,
            width: stored.width,
            height: stored.height,
            sizeBytes: stored.sizeBytes,
            altText,
          },
        });
        await logActivity(tx, admin.id, "media.upload", "media", created.id);
        return created;
      });
      return NextResponse.json(withMediaUrl(media), { status: 201 });
    } catch (err) {
      // Pas de fichier orphelin si l'écriture en base échoue.
      await deleteStoredImage(stored.key);
      throw err;
    }
  });
}
