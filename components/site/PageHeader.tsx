import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  index,
  label,
  title,
  lead,
  aside,
  className,
}: {
  index: string;
  label: string;
  title: ReactNode;
  lead?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className="page-pad mx-auto max-w-6xl border-b-2 border-ink pb-10 pt-14">
      <p className="label-mono flex items-center gap-3 text-accent">
        <span className="font-semibold">{index}</span> / {label}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </p>
      <div className={cn("mt-5 flex flex-col justify-between gap-8 md:flex-row md:items-end", className)}>
        <h1 className="max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          {title}
        </h1>
        {lead ? <p className="max-w-sm text-base leading-relaxed text-ink-soft md:pb-2">{lead}</p> : null}
      </div>
      {aside ? <div className="mt-8">{aside}</div> : null}
    </header>
  );
}