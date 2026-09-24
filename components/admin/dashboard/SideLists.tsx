import Link from "next/link";
import { formatParis } from "@/lib/time/paris";

type Conversation = { id: string; visitorName: string | null; updatedAt: Date; messages: { sender: string }[] };

/** Dernières conversations réelles, avec leur état (à répondre ou non). */
export function RecentConversations({ items }: { items: Conversation[] }) {
  return (
    <div className="border border-dashed border-line-strong p-5">
      <p className="font-mono text-xs text-ink-faint">Conversations récentes</p>
      {items.length === 0 ? <p className="mt-3 text-ink-faint">Aucune conversation.</p> : null}
      <ul className="mt-3 space-y-1.5">
        {items.map((c) => (
          <li key={c.id}>
            <Link href="/admin/messages" className="flex justify-between gap-3 hover:text-accent">
              <span className="truncate">
                {c.visitorName || "Visiteur anonyme"}
                {c.messages[0]?.sender === "VISITOR" ? <span className="ml-2 font-mono text-[0.6rem] text-accent">à répondre</span> : null}
              </span>
              <span className="shrink-0 text-ink-faint">{formatParis(c.updatedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rappels calculés depuis les données (RDV, messages, leads). */
export function Reminders({ items }: { items: { text: string; href: string }[] }) {
  return (
    <div className="border border-dashed border-line-strong p-5">
      <p className="font-mono text-xs text-ink-faint">Rappels</p>
      {items.length === 0 ? <p className="mt-3 text-ink-soft">Rien d'urgent : tout est à jour.</p> : null}
      <ul className="mt-3 space-y-1.5 text-ink-soft">
        {items.map((r) => (
          <li key={r.text}>
            <Link href={r.href} className="hover:text-accent">• {r.text}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
