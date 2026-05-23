import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminLotWithdrawalsLoading() {
  return (
    <CatalogListPageSkeleton
      title="Lots"
      description="Loading withdrawal queue…"
      kpiTiles={0}
      tableRows={6}
      tableColumns={5}
      showFilterBar={false}
    />
  );
}
