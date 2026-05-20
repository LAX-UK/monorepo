import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function LotsLoading() {
  return (
    <AdminListPageSkeleton
      title="Lots"
      description="Loading lots…"
      kpiTiles={4}
      tableRows={10}
      tableColumns={7}
    />
  );
}
