import { CategoryChildrenTab } from "@/components/admin/category-detail/tabs/children-lots-tabs";
import { loadAdminCategoryChildrenPage } from "@/lib/admin/categories/load-category-children-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategoryChildrenPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminCategoryChildrenPage(id);

  return <CategoryChildrenTab categoryId={page.categoryId} allCategories={page.allCategories} />;
}
