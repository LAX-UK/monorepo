import { CategoryActivityTab } from "@/components/admin/category-detail/tabs/activity-tab";
import { loadAdminCategoryActivityPage } from "@/lib/admin/categories/load-category-activity-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategoryActivityPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminCategoryActivityPage(id);

  return <CategoryActivityTab categoryId={page.categoryId} events={page.events} />;
}
