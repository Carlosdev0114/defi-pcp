import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Connexion — Back-office",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // Rendu à chaque requête : indispensable pour que Next applique le nonce
  // CSP généré par proxy.ts (une page statique n'a pas de requête à lire).
  await connection();

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-bg px-4 py-12">
      <div className="w-full max-w-md border-2 border-ink bg-cream p-8">
        <p className="label-mono text-accent">Zone restreinte</p>
        <h1 className="mt-2 font-display text-3xl leading-tight">Espace de pilotage</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          L'accès est vérifié côté serveur à chaque requête et sur chaque
          route de l'API sensibles : ni la page ni les données ne transitent
          si la session n'est pas ADMIN.
        </p>
        <AdminLoginForm />
        <p className="mt-6 border-t border-line pt-4 font-mono text-xs text-ink-faint">
          <Link href="/" className="hover:text-accent">← Retour au site public</Link>
        </p>
      </div>
    </div>
  );
}