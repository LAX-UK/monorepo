import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function AdminCategoriesLoading() {
  return (
    <AdminListPageSkeleton
      title="Categories"
      description="Loading categories…"
      kpiTiles={0}
      tableRows={8}
      tableColumns={4}
      showToolbar
    />
  );
}
