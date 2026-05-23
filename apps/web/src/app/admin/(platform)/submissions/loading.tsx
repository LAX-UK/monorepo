import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function AdminSubmissionsLoading() {
  return (
    <AdminListPageSkeleton
      title="Submissions"
      description="Loading submissions…"
      kpiTiles={3}
      tableRows={10}
      tableColumns={5}
    />
  );
}
