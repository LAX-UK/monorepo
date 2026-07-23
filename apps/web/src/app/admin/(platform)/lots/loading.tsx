import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function LotsLoading() {
  return (
    <CatalogListPageSkeleton
      title="Lots"
      description="Loading lots…"
      kpiTiles={6}
      tableRows={10}
      tableColumns={6}
    />
  );
}
