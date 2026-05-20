import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function StaffLoading() {
  return (
    <AdminListPageSkeleton
      title="Staff"
      description="Loading staff…"
      kpiTiles={4}
      tableRows={10}
      tableColumns={6}
    />
  );
}
