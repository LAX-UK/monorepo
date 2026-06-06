import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminComplianceAmlLoading() {
  return (
    <CatalogListPageSkeleton
      title="AML / sanctions screening"
      description="Loading AML screenings…"
      kpiTiles={3}
      tableRows={8}
      tableColumns={5}
    />
  );
}
