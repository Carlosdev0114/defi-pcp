"use client";

import { useEffect, useRef } from "react";

/** Toutes les 2 min 30, un rafraîchissement COMPLET (filet de sécurité si un
 * incrément Redis a été perdu : les versions sont best-effort). */
export const FULL_REFRESH_MS = 150_000;

/** Faut-il un rafraîchissement complet ? (pur, testable) */
export function needsFullRefresh(lastFullAt: number | null, now: number, fullRefreshMs = FULL_REFRESH_MS): boolean {
  return lastFullAt === null || now - lastFullAt >= fullRefreshMs;
}

/**
 * Polling court : `tick(full)` immédiatement, puis toutes les `intervalMs`,
 * UNIQUEMENT quand l'onglet est visible (arrêt complet sinon ; reprise
 * immédiate au retour). Jamais deux ticks en parallèle.
 */
export function usePoll(tick: (full: boolean) => Promise<void>, intervalMs: number, enabled = true) {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastFullAt: number | null = null;
    let running = false;

    const run = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      const full = needsFullRefresh(lastFullAt, Date.now());
      try {
        await tickRef.current(full);
        if (full) lastFullAt = Date.now();
      } finally {
        running = false;
      }
    };
    const start = () => {
      if (timer) return;
      run();
      timer = setInterval(run, intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
