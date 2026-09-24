import { AdminPage } from "@/components/admin/ui";
import { ProjectsManager } from "@/components/admin/content/projects/ProjectsManager";

export default function AdminProjectsPage() {
  return (
    <AdminPage className="max-w-5xl">
      <ProjectsManager />
    </AdminPage>
  );
}