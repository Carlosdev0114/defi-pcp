import Link from "next/link";

// Marque partagée entre les navigations publique (serveur) et admin (client).
// Composant neutre : AUCUNE dépendance serveur (ni server-only, ni base, ni
// Redis) pour rester importable depuis un Client Component.

export function Brand({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "·").toLowerCase();
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label={name ? `${name} — accueil` : "Accueil"}>
      <span aria-hidden="true" className="relative flex h-9 w-9 items-center justify-center border-2 border-ink bg-ink">
        <span className="font-display text-lg leading-none text-cream">{initial}.</span>
        <span className="absolute -right-1.5 -top-1.5 h-3 w-3 bg-accent transition-transform group-hover:scale-125" />
      </span>
      {name ? <span className="hidden text-sm font-semibold tracking-tight sm:block">{name}</span> : null}
    </Link>
  );
}