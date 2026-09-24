import { AdminPage } from "@/components/admin/ui";
import { SkillsManager } from "@/components/admin/content/skills/SkillsManager";

export default function AdminSkillsPage() {
  return (
    <AdminPage className="max-w-5xl">
      <SkillsManager />
    </AdminPage>
  );
}