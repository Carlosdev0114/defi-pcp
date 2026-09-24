import { AdminPage } from "@/components/admin/ui";
import { ExperiencesManager } from "@/components/admin/content/experiences/ExperiencesManager";

export default function AdminJourneyPage() {
  return (
    <AdminPage className="max-w-4xl">
      <ExperiencesManager />
    </AdminPage>
  );
}