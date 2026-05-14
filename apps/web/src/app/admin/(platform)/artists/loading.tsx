import { AdminListPage } from "@/components/admin/admin-list-page";
import { TableSkeleton } from "@auction/ui";

export default function AdminArtistsLoading() {
  return (
    <AdminListPage
      title="Artists"
      description="Loading catalogue…"
      hasFilters={false}
      resetHref="/admin/artists"
      errorAlert={null}
      filters={null}
      view={<TableSkeleton rows={10} columns={8} />}
      pagination={null}
    />
  );
}
