import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function ClientsLoading() {
  return (
    <AdminListPageSkeleton
      title="Clients"
      description="Loading clients…"
      kpiTiles={4}
      tableRows={10}
      tableColumns={6}
    />
  );
}
