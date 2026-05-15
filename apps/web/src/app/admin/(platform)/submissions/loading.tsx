import { AdminListPage } from "@/components/admin/admin-list-page";
import { TableSkeleton } from "@auction/ui";

export default function AdminSubmissionsLoading() {
  return (
    <AdminListPage
      title="Submissions"
      description="Loading submissions…"
      hasFilters={false}
      resetHref="/admin/submissions"
      errorAlert={null}
      filters={null}
      view={<TableSkeleton rows={10} columns={5} />}
      pagination={null}
    />
  );
}
