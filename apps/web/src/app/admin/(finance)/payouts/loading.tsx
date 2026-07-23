import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function PayoutsLoading() {
  return (
    <CatalogListPageSkeleton
      title="Payouts"
      description="Loading payouts…"
      kpiTiles={6}
      tableRows={8}
      tableColumns={4}
    />
  );
}
