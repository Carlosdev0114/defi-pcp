"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNav } from "@/lib/config/admin-nav";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/site/SiteNav";

export function AdminSidebar({ brandName }: { brandName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r-2 border-ink bg-admin-sidebar text-cream">
      <div className="flex h-16 items-center border-b border-cream/15 px-4">
        <Brand name={brandName} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-6">
          {Object.entries(adminNav).map(([group, items]) => (
            <div key={group}>
              <p className="label-mono px-2 text-cream/40">{group}</p>
              <ul className="mt-2 space-y-0.5">
                {items.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-none px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "bg-accent font-medium text-cream"
                            : "text-cream/70 hover:bg-cream/10 hover:text-cream"
                        )}
                      >
                        <span className="w-4 text-center text-xs" aria-hidden="true">
                          {item.glyph}
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="border-t border-cream/15 p-4">
        <Link
          href="/"
          className="flex items-center justify-between px-1 font-mono text-xs text-cream/60 transition-colors hover:text-accent"
        >
          Voir le site
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </aside>
  );
}