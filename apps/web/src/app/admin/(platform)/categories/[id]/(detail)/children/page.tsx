import { CategoryChildrenTab } from "@/components/admin/category-detail/tabs/children-lots-tabs";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategoryChildrenPage({ params }: Props) {
  const { id } = await params;
  await loadAdminCategoryDetail(id);
  const allCategories = await getAdminCategoryList({ includeArchived: true });

  return <CategoryChildrenTab categoryId={id} allCategories={allCategories} />;
}
