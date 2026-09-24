import { AdminPage } from "@/components/admin/ui";
import { LeadsBoard } from "@/components/admin/crm/LeadsBoard";

export default function AdminLeadsPage() {
  return (
    <AdminPage className="max-w-6xl">
      <LeadsBoard />
    </AdminPage>
  );
}
