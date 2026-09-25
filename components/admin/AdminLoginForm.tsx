"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";

function AdminLoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  // Jamais de redirection vers une cible externe (?next=//evil.com…).
  const next = safeRedirectPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible de se connecter.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Le service d'authentification est injoignable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="label-mono text-ink-soft">E-mail</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full border-2 border-ink bg-cream px-3 py-2.5 text-sm outline-none focus:border-accent"
          placeholder="admin@example.com"
        />
      </label>

      <label className="block">
        <span className="label-mono text-ink-soft">Mot de passe</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full border-2 border-ink bg-cream px-3 py-2.5 text-sm outline-none focus:border-accent"
          placeholder="••••••••"
        />
      </label>

      {error ? (
        <p className="border-2 border-accent bg-accent/10 px-3 py-2 font-mono text-xs text-accent-ink" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full border-2 border-ink bg-ink px-4 py-3 font-mono text-sm text-cream transition-colors hover:bg-accent disabled:opacity-60"
      >
        {busy ? "Vérification…" : "Se connecter"}
      </button>

      <p className="font-mono text-[0.65rem] text-ink-faint">
        Session en Redis, cookie HttpOnly, 5 tentatives / 10 min par compte.
      </p>
    </form>
  );
}

export function AdminLoginForm() {
  return (
    <Suspense fallback={null}>
      <AdminLoginFormInner />
    </Suspense>
  );
}