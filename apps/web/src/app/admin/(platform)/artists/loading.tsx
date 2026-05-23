import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function AdminArtistsLoading() {
  return (
    <AdminListPageSkeleton
      title="Artists"
      description="Loading artists…"
      kpiTiles={4}
      tableRows={10}
      tableColumns={8}
    />
  );
}
