import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function PaymentsLoading() {
  return (
    <CatalogListPageSkeleton
      title="Payments"
      description="Loading payments…"
      kpiTiles={4}
      tableRows={10}
      tableColumns={6}
      showFilterBar
    />
  );
}
