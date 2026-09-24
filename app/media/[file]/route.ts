import { NextRequest, NextResponse } from "next/server";
import { getStorage, isStorageKey } from "@/lib/server/storage";

// Sert les médias du driver `local` (dev). Avec `vercel-blob`, les URL
// pointent directement vers le CDN Blob : cette route ne sert rien.
// La clé est validée strictement (UUID + .webp) : aucune traversée de
// répertoire possible, et seul du WebP ré-encodé par sharp est servi.
export async function GET(_req: NextRequest, ctx: RouteContext<"/media/[file]">) {
  const { file } = await ctx.params;
  const storage = getStorage();
  if (storage.driver !== "local" || !isStorageKey(file)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const data = await storage.get(file);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
