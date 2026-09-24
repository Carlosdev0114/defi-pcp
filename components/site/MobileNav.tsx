"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { navLinks } from "@/lib/config/site-nav";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { useState } from "react";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        className="flex h-10 w-10 items-center justify-center border-2 border-ink"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full border-b-2 border-ink bg-paper">
          <nav className="flex flex-col px-5 py-4">
            {navLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-baseline gap-3 border-b border-line py-3"
              >
                <span className="font-mono text-xs text-accent">0{i + 1}</span>
                <span
                  className={
                    pathname.startsWith(link.href)
                      ? "font-display text-2xl text-accent"
                      : "font-display text-2xl"
                  }
                >
                  {link.label}
                </span>
              </Link>
            ))}
            <Link
              href="/reservation"
              onClick={() => setOpen(false)}
              className="mt-4 bg-accent px-5 py-3 text-center font-mono text-sm text-cream"
            >
              Réserver un créneau
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}