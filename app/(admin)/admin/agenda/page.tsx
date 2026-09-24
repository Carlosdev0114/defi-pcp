import { AdminPage } from "@/components/admin/ui";
import { AppointmentsBoard } from "@/components/admin/appointments/AppointmentsBoard";

export default function AdminAgendaPage() {
  return (
    <AdminPage className="max-w-6xl">
      <AppointmentsBoard />
    </AdminPage>
  );
}
