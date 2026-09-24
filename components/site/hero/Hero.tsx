import { HeroContent } from "./HeroContent";
import { HeroVisual } from "./HeroVisual";
import { Ticker } from "../Ticker";
import type { Profile } from "@/lib/schemas/site";

const tickerItems = [
  "Next.js",
  "TypeScript",
  "PostgreSQL",
  "Interfaces & systèmes",
  "SaaS",
  "Accessibilité",
  "Disponible pour mission — Q4 2025",
  "Lyon / remote",
];

export default function Hero({ profile }: { profile: Profile }) {
  return (
    <section className="border-b-2 border-ink">
      <div className="page-pad mx-auto grid max-w-6xl items-center gap-12 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
        <HeroContent profile={profile} />
        <HeroVisual name={profile.name} />
      </div>
      <Ticker items={tickerItems} />
    </section>
  );
}