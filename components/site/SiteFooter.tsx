import Link from "next/link";
import { footerLinks } from "@/lib/config/site-nav";
import { getProfile } from "@/lib/server/site-config";

export default async function SiteFooter() {
  const profile = await getProfile();
  const socials = [profile.socials.github, profile.socials.linkedin, profile.socials.mastodon].filter(Boolean);

  return (
    <footer className="border-t-2 border-ink bg-ink text-cream">
      <div className="page-pad mx-auto grid max-w-6xl gap-10 py-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-3xl">{profile.name}</p>
          {profile.role ? <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream/70">{profile.role}</p> : null}
          {profile.email ? <p className="label-mono mt-6 text-accent">{profile.email}</p> : null}
        </div>

        {(
          [
            ["Explorer", footerLinks.explore],
            ["Services", footerLinks.services],
          ] as const
        ).map(([title, links]) => (
          <div key={title}>
            <p className="label-mono text-cream/50">{title}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-cream/80 transition-colors hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {socials.length ? (
          <div>
            <p className="label-mono text-cream/50">Ailleurs</p>
            <ul className="mt-4 space-y-2 font-mono text-xs text-cream/80">
              {socials.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="border-t border-cream/15">
        <div className="page-pad mx-auto flex max-w-6xl flex-col gap-2 py-5 font-mono text-xs text-cream/40 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {profile.name}
            {profile.location ? ` — ${profile.location}` : ""}
          </span>
          <span>Propulsé par une longue et fragile chaîne de bonnes intentions</span>
        </div>
      </div>
    </footer>
  );
}
