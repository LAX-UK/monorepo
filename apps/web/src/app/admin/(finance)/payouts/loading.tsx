import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function PayoutsLoading() {
  return (
    <AdminListPageSkeleton
      title="Payouts"
      description="Loading payouts…"
      kpiTiles={4}
      tableRows={8}
      tableColumns={7}
      showReadinessBand
    />
  );
}
