import { cn } from "@/lib/utils";

/**
 * Espace réservé au portrait, en attendant une vraie photo : silhouette
 * neutre en SVG inline (aucune requête, aucun fichier). Le libellé suit le
 * nom du profil. Même proportion que le portrait (600 × 720).
 */
export function PortraitPlaceholder({ name, className }: { name: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={name ? `Portrait de ${name} (photo à venir)` : "Portrait (photo à venir)"}
      className={cn("flex aspect-[5/6] w-full items-end justify-center overflow-hidden bg-paper text-line-strong", className)}
    >
      <svg viewBox="0 0 600 720" aria-hidden="true" className="h-[88%] w-auto" fill="currentColor">
        <circle cx="300" cy="250" r="118" />
        <path d="M60 720c0-150 108-262 240-262s240 112 240 262Z" />
      </svg>
    </div>
  );
}
