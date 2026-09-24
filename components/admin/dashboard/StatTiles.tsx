import Link from "next/link";

export type StatTile = { label: string; value: string; sub: string; href: string };

export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((s) => (
        <Link key={s.label} href={s.href} className="group border-2 border-ink bg-cream p-5 transition-transform hover:-translate-y-0.5">
          <p className="label-mono text-ink-faint">{s.label}</p>
          <p className="mt-2 font-display text-4xl text-accent group-hover:text-accent-strong">{s.value}</p>
          <p className="mt-1 font-mono text-xs text-ink-soft">{s.sub}</p>
        </Link>
      ))}
    </div>
  );
}
