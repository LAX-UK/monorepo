import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { CategoryOverviewTab } from "@/components/admin/category-detail/tabs/overview-tab";
import { loadAdminCategoryOverviewPage } from "@/lib/admin/categories/load-category-overview-page";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminCategoryOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = await loadAdminCategoryOverviewPage(id);

  return (
    <>
      <CatalogDetailActionError error={sp.error} title="Could not save category" />
      <CategoryOverviewTab
        categoryId={id}
        category={page.category}
        allCategories={page.allCategories}
        directChildCount={page.directChildCount}
        descendantCount={page.descendantCount}
        previewLots={page.previewLots}
        previewSales={page.previewSales}
        previewSubmissions={page.previewSubmissions}
        activityEvents={page.activityEvents}
      />
    </>
  );
}
