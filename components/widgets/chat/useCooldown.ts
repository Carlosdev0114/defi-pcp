"use client";

import { useCallback, useEffect, useState } from "react";
import { remainingSeconds } from "@/lib/chat/client";

/** Blocage temporaire (Retry-After) avec compte à rebours à la seconde. */
export function useCooldown() {
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (blockedUntil === null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= blockedUntil) setBlockedUntil(null);
    }, 250);
    return () => clearInterval(timer);
  }, [blockedUntil]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setBlockedUntil(current + seconds * 1000);
  }, []);

  return { secondsLeft: remainingSeconds(blockedUntil, now), start };
}
