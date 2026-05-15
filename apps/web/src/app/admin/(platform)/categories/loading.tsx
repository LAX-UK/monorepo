import { AdminListPage } from "@/components/admin/admin-list-page";
import { TableSkeleton } from "@auction/ui";

export default function AdminCategoriesLoading() {
  return (
    <AdminListPage
      title="Categories"
      description="Loading categories…"
      hasFilters={false}
      resetHref="/admin/categories"
      errorAlert={null}
      filters={null}
      view={<TableSkeleton rows={8} columns={4} />}
      pagination={null}
    />
  );
}
