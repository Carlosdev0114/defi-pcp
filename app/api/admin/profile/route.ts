import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { withAdmin, parseJsonBody } from "@/lib/server/api";
import { getProfile, setProfile } from "@/lib/server/site-config";
import { profileSchema } from "@/lib/schemas/site";
import { revalidateContent } from "@/lib/server/revalidate";

/** Profil public (Redis, clé `public:profile`). */
export function GET() {
  return withAdmin("GET /api/admin/profile", async () => NextResponse.json({ profile: await getProfile() }));
}

/** Enregistre le profil puis régénère tout le site public et marque l'index du chatbot périmé. */
export function PUT(req: NextRequest) {
  return withAdmin("PUT /api/admin/profile", async (admin) => {
    const { data, error } = await parseJsonBody(req, profileSchema);
    if (error) return error;
    const profile = await setProfile(data);
    await db.activity.create({ data: { userId: admin.id, action: "profile.update", entity: "profile" } });
    await revalidateContent("profile");
    return NextResponse.json({ profile });
  });
}
