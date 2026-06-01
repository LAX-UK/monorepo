import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminLotFulfilmentLoading() {
  return (
    <CatalogListPageSkeleton
      title="Lot fulfilment"
      description="Loading fulfilment queue…"
      kpiTiles={3}
      tableRows={8}
      tableColumns={5}
    />
  );
}
