import { CategorySalesTab } from "@/components/admin/category-detail/tabs/children-lots-tabs";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminSalesList } from "@/lib/data/http/admin.server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategorySalesPage({ params }: Props) {
  const { id } = await params;
  const category = await loadAdminCategoryDetail(id);
  const sales = await getAdminSalesList({ categoryId: id, limit: 50 }).catch(() => []);

  return <CategorySalesTab sales={sales} totalCount={category.usage.sales} />;
}
