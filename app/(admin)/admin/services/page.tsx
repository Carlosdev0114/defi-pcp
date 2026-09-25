import { AdminPage } from "@/components/admin/ui";
import { ServicesManager } from "@/components/admin/services/ServicesManager";

export default function AdminServicesPage() {
  return (
    <AdminPage className="max-w-5xl">
      <ServicesManager />
    </AdminPage>
  );
}
