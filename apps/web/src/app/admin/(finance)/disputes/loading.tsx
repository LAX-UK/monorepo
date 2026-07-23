import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function DisputesLoading() {
  return (
    <CatalogListPageSkeleton
      title="Payment disputes"
      description="Loading disputes…"
      kpiTiles={4}
      showFilterBar
      tableRows={8}
      tableColumns={5}
    />
  );
}
