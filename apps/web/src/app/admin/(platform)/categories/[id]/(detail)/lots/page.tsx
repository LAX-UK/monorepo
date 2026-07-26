import { CategoryLotsTab } from "@/components/admin/category-detail/tabs/children-lots-tabs";
import { loadAdminCategoryLotsPage } from "@/lib/admin/categories/load-category-lots-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategoryLotsPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminCategoryLotsPage(id);

  return <CategoryLotsTab lots={page.lots} totalCount={page.totalCount} />;
}
