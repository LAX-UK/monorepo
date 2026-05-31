import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function AdminLoading() {
  return <AdminListPageSkeleton title="Loading admin…" kpiTiles={0} showToolbar={false} />;
}
