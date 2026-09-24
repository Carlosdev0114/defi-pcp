import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { requireAdminPage } from "@/lib/server/guard";
import { AdminRealtimeProvider } from "@/components/admin/realtime/AdminRealtimeProvider";
import { getProfile, getSettings } from "@/lib/server/site-config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Vérification serveur (session Redis + rôle ADMIN en base), en plus du proxy.
  const admin = await requireAdminPage();
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);

  return (
    <AdminRealtimeProvider>
      <div className="flex h-screen w-full overflow-hidden bg-admin-bg">
        <div className="hidden md:flex">
          <AdminSidebar brandName={profile.name} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar siteName={settings.siteName} userName={admin.name || admin.email} />
          <AdminMobileNav />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </AdminRealtimeProvider>
  );
}
