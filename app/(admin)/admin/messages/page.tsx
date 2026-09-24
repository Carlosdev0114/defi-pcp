import { AdminPage } from "@/components/admin/ui";
import { MessagesBoard } from "@/components/admin/messages/MessagesBoard";

export default function AdminMessagesPage() {
  return (
    <AdminPage className="max-w-5xl">
      <MessagesBoard />
    </AdminPage>
  );
}
