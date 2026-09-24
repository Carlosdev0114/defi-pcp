import { NotificationBell } from "@/components/admin/realtime/NotificationBell";

export function AdminTopbar({ siteName, userName }: { siteName: string; userName: string }) {
  const initials = userName.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "A";
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b-2 border-ink bg-cream px-5">
      <p className="font-display text-xl">{siteName}</p>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="flex items-center gap-2 border-2 border-ink bg-paper px-3 py-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent font-mono text-[0.65rem] text-cream">
            {initials}
          </span>
          <div className="leading-tight">
            <p className="font-mono text-xs font-semibold">{userName}</p>
            <p className="font-mono text-[0.6rem] text-ink-faint">admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
