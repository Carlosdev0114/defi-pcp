import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "accent";

const base =
  "inline-flex items-center justify-center gap-2 font-mono text-sm font-medium transition-colors select-none disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-cream px-5 py-3 border-2 border-ink hover:bg-accent hover:border-accent",
  outline: "bg-transparent text-ink px-5 py-3 border-2 border-ink hover:bg-ink hover:text-cream",
  ghost: "text-ink px-2 py-2 hover:text-accent underline-offset-4 hover:underline",
  accent: "bg-accent text-cream px-5 py-3 border-2 border-ink hover:bg-accent-strong",
};

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link className={cn(base, variants[variant], className)} {...props}>
      {children}
    </Link>
  );
}

export function SectionLabel({
  index,
  children,
  className,
}: {
  index?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("label-mono flex items-center gap-3 text-ink-soft", className)}>
      {index ? <span className="text-accent">{index}</span> : null}
      <span>{children}</span>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </p>
  );
}