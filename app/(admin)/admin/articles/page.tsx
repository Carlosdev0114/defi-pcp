import { AdminPage } from "@/components/admin/ui";
import { ArticlesManager } from "@/components/admin/content/articles/ArticlesManager";

export default function AdminArticlesPage() {
  return (
    <AdminPage className="max-w-5xl">
      <ArticlesManager />
    </AdminPage>
  );
}