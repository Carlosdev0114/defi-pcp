"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Signale une page vue (chemin seulement) au serveur, sans cookie ni
 * identifiant. Respecte « Do Not Track ». sendBeacon ne bloque pas la page.
 */
export function VisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || typeof navigator === "undefined" || !navigator.sendBeacon) return;
    if (navigator.doNotTrack === "1") return;
    navigator.sendBeacon("/api/public/visit", new Blob([JSON.stringify({ path: pathname })], { type: "application/json" }));
  }, [pathname]);

  return null;
}
