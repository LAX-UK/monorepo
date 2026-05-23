import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminArtistsLoading() {
  return (
    <CatalogListPageSkeleton
      title="Artists"
      description="Loading artists…"
      kpiTiles={6}
      tableRows={10}
      tableColumns={8}
    />
  );
}
