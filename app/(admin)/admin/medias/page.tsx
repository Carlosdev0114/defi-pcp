import { AdminPage } from "@/components/admin/ui";
import { MediaManager } from "@/components/admin/content/MediaManager";

export default function AdminMediaPage() {
  return (
    <AdminPage className="max-w-5xl">
      <MediaManager />
    </AdminPage>
  );
}