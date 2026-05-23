import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminSubmissionsLoading() {
  return (
    <CatalogListPageSkeleton
      title="Submissions"
      description="Loading submissions…"
      kpiTiles={3}
      tableRows={10}
      tableColumns={5}
    />
  );
}
