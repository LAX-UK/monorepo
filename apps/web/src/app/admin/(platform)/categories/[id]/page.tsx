import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { CategoryOverviewTab } from "@/components/admin/category-detail/tabs/overview-tab";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminCategoryOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const category = await loadAdminCategoryDetail(id);

  return (
    <>
      <CatalogDetailActionError error={sp.error} title="Could not save category" />
      <CategoryOverviewTab categoryId={id} category={category} />
    </>
  );
}
