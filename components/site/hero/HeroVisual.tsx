import { ProfilePortrait } from "@/components/site/ProfilePortrait";
import type { Profile } from "@/lib/schemas/site";

export function HeroVisual({ profile }: { profile: Pick<Profile, "name" | "photoMediaId"> }) {
  return (
    <figure className="relative">
      <div className="absolute -inset-3 -z-10 translate-x-2 translate-y-2 border-2 border-ink bg-accent" aria-hidden="true" />
      <div className="border-2 border-ink bg-cream p-2">
        <ProfilePortrait profile={profile} sizes="(min-width: 768px) 460px, 92vw" preload />
      </div>
    </figure>
  );
}
