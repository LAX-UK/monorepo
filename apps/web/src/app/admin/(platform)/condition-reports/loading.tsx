import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminConditionReportsLoading() {
  return (
    <CatalogListPageSkeleton
      title="Condition report requests"
      description="Loading condition report requests…"
      kpiTiles={0}
      tableRows={8}
      tableColumns={5}
    />
  );
}
