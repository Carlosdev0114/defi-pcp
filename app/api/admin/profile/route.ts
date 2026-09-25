import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody, apiError } from "@/lib/server/api";
import { getProfile, setProfile } from "@/lib/server/site-config";
import { profileSchema } from "@/lib/schemas/site";
import { revalidateContent } from "@/lib/server/revalidate";
import { withMediaUrl } from "@/lib/server/storage";

const photoSelect = { id: true, url: true, altText: true } as const;

/** Profil public (Redis, clé `public:profile`), avec la photo résolue pour l'aperçu admin. */
export function GET() {
  return withAdmin("GET /api/admin/profile", async () => {
    const profile = await getProfile();
    const photo = profile.photoMediaId ? await db.media.findUnique({ where: { id: profile.photoMediaId }, select: photoSelect }) : null;
    return NextResponse.json({ profile, photo: withMediaUrl(photo) });
  });
}

/** Enregistre le profil puis régénère tout le site public et marque l'index du chatbot périmé. */
export function PUT(req: NextRequest) {
  return withAdmin("PUT /api/admin/profile", async (admin) => {
    const { data, error } = await parseJsonBody(req, profileSchema);
    if (error) return error;
    if (data.photoMediaId && !(await db.media.findUnique({ where: { id: data.photoMediaId }, select: { id: true } }))) {
      return apiError("Photo introuvable dans la médiathèque.", 400);
    }
    const profile = await setProfile(data);
    await db.activity.create({ data: { userId: admin.id, action: "profile.update", entity: "profile" } });
    await revalidateContent("profile");
    return NextResponse.json({ profile });
  });
}
