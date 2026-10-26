import { CategoryOverviewTab } from "@/components/admin/category-detail/tabs/overview-tab";
import { StaffActionError } from "@/components/admin/staff/staff-action-error";
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
      <StaffActionError error={sp.error} title="The category was not saved" />
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
