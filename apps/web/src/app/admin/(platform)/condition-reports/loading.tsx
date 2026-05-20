import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function ConditionReportsLoading() {
  return (
    <AdminListPageSkeleton
      title="Condition reports"
      description="Loading requests…"
      kpiTiles={2}
      tableRows={8}
      tableColumns={5}
    />
  );
}
