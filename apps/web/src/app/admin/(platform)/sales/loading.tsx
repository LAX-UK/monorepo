import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminSalesLoading() {
  return (
    <CatalogListPageSkeleton
      title="Sales"
      description="Loading sales…"
      kpiTiles={3}
      tableRows={10}
      tableColumns={5}
    />
  );
}
