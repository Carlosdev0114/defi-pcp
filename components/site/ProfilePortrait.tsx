import Image from "next/image";
import { PortraitPlaceholder } from "@/components/site/PortraitPlaceholder";
import { getProfilePhoto } from "@/lib/server/content";
import type { Profile } from "@/lib/schemas/site";
import { cn } from "@/lib/utils";

/**
 * Portrait du profil : la photo choisie dans /admin/profil (médiathèque),
 * sinon l'espace réservé. Changer de photo ne demande aucun redéploiement.
 */
export async function ProfilePortrait({
  profile,
  sizes,
  preload = false,
  className,
}: {
  profile: Pick<Profile, "name" | "photoMediaId">;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  const photo = await getProfilePhoto(profile.photoMediaId);
  if (!photo) return <PortraitPlaceholder name={profile.name} className={className} />;
  return (
    <Image
      src={photo.url}
      alt={photo.altText || (profile.name ? `Portrait de ${profile.name}` : "Portrait")}
      width={photo.width ?? 600}
      height={photo.height ?? 720}
      sizes={sizes}
      preload={preload}
      className={cn("aspect-[5/6] h-auto w-full object-cover", className)}
    />
  );
}
