import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function ManualReviewLoading() {
  return (
    <AdminListPageSkeleton
      title="Manual review"
      description="Loading payments…"
      kpiTiles={0}
      tableRows={8}
      tableColumns={6}
      showToolbar={false}
    />
  );
}
