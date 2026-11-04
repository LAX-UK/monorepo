import { CategoryOverviewTab } from "@/components/admin/category-detail/tabs/overview-tab";
import { loadAdminCategoryOverviewPage } from "@/lib/admin/categories/load-category-overview-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategoryOverviewPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminCategoryOverviewPage(id);

  return (
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
  );
}
