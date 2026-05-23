import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import {
  categoryDescendantsOf,
  categoryDirectChildrenOf,
} from "@/components/admin/category-detail/category-detail-helpers";
import { CategoryOverviewTab } from "@/components/admin/category-detail/tabs/overview-tab";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import {
  getAdminCategoryList,
  getAdminLotList,
  getAdminSalesList,
} from "@/lib/data/http/admin.server";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminCategoryOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [category, allCategories, previewLots, previewSales, previewSubmissions] =
    await Promise.all([
      loadAdminCategoryDetail(id),
      getAdminCategoryList({ includeArchived: true }),
      getAdminLotList({ categoryId: id, limit: 3 }).catch(() => []),
      getAdminSalesList({ categoryId: id, limit: 3 }).catch(() => []),
      getAdminSubmissions({ categoryId: id, limit: 3 }).catch(() => ({ rows: [], total: 0 })),
    ]);
  const directChildCount = categoryDirectChildrenOf(id, allCategories).length;
  const descendantCount = categoryDescendantsOf(id, allCategories).length;

  return (
    <>
      <CatalogDetailActionError error={sp.error} title="Could not save category" />
      <CategoryOverviewTab
        categoryId={id}
        category={category}
        allCategories={allCategories}
        directChildCount={directChildCount}
        descendantCount={descendantCount}
        previewLots={previewLots}
        previewSales={previewSales}
        previewSubmissions={previewSubmissions.rows}
      />
    </>
  );
}
