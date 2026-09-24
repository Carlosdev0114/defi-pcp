import { AdminPage } from "@/components/admin/ui";
import { SettingsAdmin } from "@/components/admin/system/SettingsAdmin";

export default function AdminSettingsPage() {
  return (
    <AdminPage className="max-w-5xl">
      <SettingsAdmin />
    </AdminPage>
  );
}