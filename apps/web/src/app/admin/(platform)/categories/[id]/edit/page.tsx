import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { CategoryEditTab } from "@/components/admin/category-detail/tabs/edit-tab";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminCategoryEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const category = await loadAdminCategoryDetail(id);
  const allCategories = await getAdminCategoryList({ includeArchived: true });

  return (
    <>
      <CatalogDetailActionError error={sp.error} title="Could not save category" />
      <CategoryEditTab category={category} allCategories={allCategories} />
    </>
  );
}
