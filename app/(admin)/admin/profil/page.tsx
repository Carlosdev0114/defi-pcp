import { AdminPage } from "@/components/admin/ui";
import { ProfileEditor } from "@/components/admin/content/ProfileEditor";

export default function AdminProfilePage() {
  return (
    <AdminPage className="max-w-4xl">
      <ProfileEditor />
    </AdminPage>
  );
}