import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminVenuesLoading() {
  return (
    <CatalogListPageSkeleton
      title="Venues"
      description="Loading venues…"
      kpiTiles={2}
      tableRows={6}
      tableColumns={4}
    />
  );
}
