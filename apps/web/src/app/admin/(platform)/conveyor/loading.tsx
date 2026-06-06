import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function ConveyorLoading() {
  return (
    <CatalogListPageSkeleton
      title="Conveyor"
      description="Loading pipeline…"
      kpiTiles={3}
      tableRows={0}
      tableColumns={5}
      showFilterBar={false}
    />
  );
}
