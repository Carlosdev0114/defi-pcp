import Link from "next/link";

/** Erreur d'API dans le back-office ; 401 = session expirée → reconnexion,
 * puis retour à la page `returnTo`. */
export function ApiErrorNotice({ status, error, returnTo = "/admin" }: { status: number; error: string; returnTo?: string }) {
  if (status === 401) {
    return (
      <p className="border-2 border-accent bg-accent/10 p-3 font-mono text-xs text-accent-ink" role="alert">
        Session expirée.{" "}
        <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="underline">
          Se reconnecter
        </Link>
      </p>
    );
  }
  return (
    <p className="border-2 border-accent bg-accent/10 p-3 font-mono text-xs text-accent-ink" role="alert">
      {error}
    </p>
  );
}
