import { CategorySalesTab } from "@/components/admin/category-detail/tabs/children-lots-tabs";
import { loadAdminCategorySalesPage } from "@/lib/admin/categories/load-category-sales-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategorySalesPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminCategorySalesPage(id);

  return <CategorySalesTab sales={page.sales} totalCount={page.totalCount} />;
}
