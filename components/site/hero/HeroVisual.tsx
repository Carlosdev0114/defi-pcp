import { PortraitPlaceholder } from "@/components/site/PortraitPlaceholder";

export function HeroVisual({ name }: { name: string }) {
  return (
    <figure className="relative">
      <div className="absolute -inset-3 -z-10 translate-x-2 translate-y-2 border-2 border-ink bg-accent" aria-hidden="true" />
      <div className="border-2 border-ink bg-cream p-2">
        <PortraitPlaceholder name={name} />
      </div>
    </figure>
  );
}