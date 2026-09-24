import Link from "next/link";
import { Panel, Tag } from "@/components/admin/ui";
import { notificationHref, notificationKind, notificationText } from "@/lib/notifications/client";
import { formatParis } from "@/lib/time/paris";

type Item = { id: string; type: string; payload: unknown; read: boolean; createdAt: Date };

/** Activité récente = les dernières notifications réelles (texte brut). */
export function ActivityPanel({ items }: { items: Item[] }) {
  return (
    <Panel title="Activité récente">
      {items.length === 0 ? <p className="text-sm text-ink-faint">Aucune activité pour le moment.</p> : null}
      <ul className="divide-y divide-line">
        {items.map((n) => (
          <li key={n.id}>
            <Link href={notificationHref(n.type)} className="flex items-start gap-3 py-3 hover:bg-paper">
              <Tag tone={n.read ? "neutral" : "accent"}>{notificationKind(n.type)}</Tag>
              <span className="flex-1">
                <span className="block text-sm leading-snug">{notificationText({ type: n.type, payload: n.payload as Record<string, unknown> | null })}</span>
                <span className="mt-0.5 block font-mono text-[0.65rem] text-ink-faint">{formatParis(n.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
