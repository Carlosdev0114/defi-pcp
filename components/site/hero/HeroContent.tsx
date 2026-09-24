import type { Profile } from "@/lib/schemas/site";

export function HeroContent({ profile }: { profile: Profile }) {
  return (
    <div>
      {profile.role || profile.location ? (
        <p className="label-mono mb-6 flex items-center gap-3 text-accent">
          <span className="inline-block h-2 w-2 bg-accent" aria-hidden="true" />
          {[profile.role, profile.location].filter(Boolean).join(" — ")}
        </p>
      ) : null}
      <h1 className="font-display text-5xl leading-[0.98] tracking-tight text-ink sm:text-6xl lg:text-7xl">
        Des interfaces qui aident les équipes à{" "}
        <span className="text-accent underline decoration-ink decoration-4 underline-offset-8">délivrer.</span>
      </h1>
      {profile.baseline ? <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">{profile.baseline}</p> : null}
      {profile.shortBio ? <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-faint">{profile.shortBio}</p> : null}
    </div>
  );
}
