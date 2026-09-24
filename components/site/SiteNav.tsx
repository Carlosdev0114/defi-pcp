import Link from "next/link";
import { navLinks } from "@/lib/config/site-nav";
import { getProfile } from "@/lib/server/site-config";
import { MobileNav } from "./MobileNav";
import { Brand } from "@/components/ui/brand";

export default async function SiteNav() {
  const profile = await getProfile();
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur-sm">
      <nav className="page-pad mx-auto flex h-16 max-w-6xl items-center justify-between">
        <Brand name={profile.name} />
        <div className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="font-mono text-sm text-ink-soft transition-colors hover:text-accent">
              {link.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/reservation"
            className="border-2 border-ink bg-transparent px-4 py-2 font-mono text-sm transition-colors hover:bg-accent hover:text-cream"
          >
            Réserver un créneau
          </Link>
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
