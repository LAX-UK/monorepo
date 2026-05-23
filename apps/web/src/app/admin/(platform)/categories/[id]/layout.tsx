import { categoryDescendantsOf } from "@/components/admin/category-detail/category-detail-helpers";
import { CategoryDetailShell } from "@/components/admin/category-detail/category-detail-shell";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminCategoryDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const category = await loadAdminCategoryDetail(id);
  const allCategories = await getAdminCategoryList({ includeArchived: true });
  const childCount = categoryDescendantsOf(id, allCategories).length;

  return (
    <CategoryDetailShell
      categoryId={id}
      category={category}
      childCount={childCount}
      lotCount={category.usage.lots}
    >
      {children}
    </CategoryDetailShell>
  );
}
