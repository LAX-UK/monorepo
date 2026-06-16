import { AdminListShell } from "@/components/admin/admin-list-shell";

export default function AdminSofCaseLoading() {
  return (
    <AdminListShell
      variant="queue"
      title="Source of Funds"
      description="Loading case…"
      view={null}
    />
  );
}
