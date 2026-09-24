"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNav } from "@/lib/config/admin-nav";
import { cn } from "@/lib/utils";

export function AdminMobileNav() {
  const pathname = usePathname();
  const items = Object.values(adminNav).flat();

  return (
    <nav className="md:hidden" aria-label="Sections du back-office">
      <ul className="flex gap-2 overflow-x-auto border-b-2 border-ink bg-paper px-3 py-2.5">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 border px-3 py-1.5 font-mono text-xs whitespace-nowrap transition-colors",
                  active
                    ? "border-ink bg-ink text-cream"
                    : "border-line-strong bg-cream text-ink-soft hover:border-ink"
                )}
              >
                <span aria-hidden="true">{item.glyph}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}