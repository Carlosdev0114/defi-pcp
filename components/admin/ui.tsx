import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-6xl px-6 py-8", className)}>{children}</div>;
}

export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow ? <p className="label-mono text-accent">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-4xl tracking-tight">{title}</h1>
        {description ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-2 border-ink bg-cream", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-4 border-b-2 border-ink bg-paper px-4 py-3">
          <h2 className="font-mono text-sm font-semibold">{title}</h2>
          {aside}
        </header>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label-mono text-ink-soft">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </label>
  );
}

export const inputBase =
  "w-full border-2 border-line-strong bg-paper px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export function Btn({
  children,
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "primary" | "accent" | "outline" | "ghost" | "danger";
}) {
  const styles: Record<string, string> = {
    primary: "bg-ink text-cream hover:bg-accent border-2 border-ink",
    accent: "bg-accent text-cream hover:bg-accent-strong border-2 border-ink",
    outline: "bg-transparent text-ink hover:bg-ink hover:text-cream border-2 border-ink",
    ghost: "text-ink-soft hover:text-accent",
    danger: "bg-transparent text-accent hover:bg-accent hover:text-cream border-2 border-accent",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2 font-mono text-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "ink" | "ok" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "border-line-strong bg-paper text-ink-soft",
    accent: "border-accent bg-accent/10 text-accent-ink",
    ink: "border-ink bg-ink text-cream",
    ok: "border-[#0e8a60] bg-[#0e8a60]/10 text-[#0a5c41]",
    warn: "border-[#d8a600] bg-[#d8a600]/15 text-[#7a5e00]",
  };
  return (
    <span className={cn("inline-flex items-center border px-2 py-0.5 font-mono text-[0.68rem]", tones[tone], className)}>
      {children}
    </span>
  );
}