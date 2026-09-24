export function Ticker({ items, className = "" }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={`overflow-hidden border-y-2 border-ink bg-accent py-2.5 ${className}`} aria-hidden="true">
      <div className="ticker-track">
        {row.map((item, i) => (
          <span
            key={i}
            className="mx-6 flex shrink-0 items-center gap-6 font-mono text-sm font-medium text-cream"
          >
            {item}
            <span className="text-monospace text-cream/70">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}