import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";

export default function AdminCategoriesLoading() {
  return (
    <CatalogListPageSkeleton
      title="Categories"
      description="Loading categories…"
      kpiTiles={6}
      tableRows={8}
      tableColumns={4}
    />
  );
}
