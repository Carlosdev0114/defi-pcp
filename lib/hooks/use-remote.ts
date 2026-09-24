"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiResult } from "@/lib/http/client";

/**
 * Charge une ressource identifiée par `key` (null = rien à charger). Le
 * chargement est dérivé de la clé courante (aucun setState synchrone dans
 * l'effet) et une réponse arrivée pour une ancienne clé est ignorée.
 */
export function useRemote<T>(key: string | null, load: () => Promise<ApiResult<T>>) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [state, setState] = useState<{ key: string; result: ApiResult<T> } | null>(null);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    loadRef.current().then((result) => {
      if (active) setState({ key, result });
    });
    return () => {
      active = false;
    };
  }, [key]);

  const result = state && state.key === key ? state.result : null;
  return { result, loading: key !== null && result === null };
}
