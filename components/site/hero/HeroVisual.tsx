import Image from "next/image";

export function HeroVisual({ name }: { name: string }) {
  return (
    <figure className="relative">
      <div className="absolute -inset-3 -z-10 translate-x-2 translate-y-2 border-2 border-ink bg-accent" aria-hidden="true" />
      <div className="border-2 border-ink bg-cream p-2">
        <Image
          src="/portrait.svg"
          alt={name ? `Portrait stylisé de ${name}` : "Portrait stylisé"}
          width={600}
          height={720}
          priority
          sizes="(min-width: 768px) 460px, 92vw"
          className="h-auto w-full"
        />
      </div>
      <figcaption className="mt-3 flex items-center justify-between font-mono text-xs text-ink-soft">
        <span>FIG.01 — Portrait de travail, 2025</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Dispo pour oct./nov.
        </span>
      </figcaption>
    </figure>
  );
}