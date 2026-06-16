import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminComplianceSofLoading() {
  return (
    <CatalogListPageSkeleton
      title="Source of Funds"
      description="Loading Source of Funds cases…"
      kpiTiles={3}
      tableRows={8}
      tableColumns={4}
    />
  );
}
