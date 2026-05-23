import {
  categoryByIdMap,
  categoryDescendantsOf,
  categoryDirectChildrenOf,
} from "@/components/admin/category-detail/category-detail-helpers";
import { CategoryDetailShell } from "@/components/admin/category-detail/category-detail-shell";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import {
  getAdminCategoryList,
  getAdminDomainEventsForAggregate,
} from "@/lib/data/http/admin.server";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminCategoryDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const [category, allCategories, activityEvents] = await Promise.all([
    loadAdminCategoryDetail(id),
    getAdminCategoryList({ includeArchived: true }),
    getAdminDomainEventsForAggregate({
      aggregateType: "category",
      aggregateId: id,
      limit: 5,
    }).catch(() => []),
  ]);
  const directChildCount = categoryDirectChildrenOf(id, allCategories).length;
  const descendantCount = categoryDescendantsOf(id, allCategories).length;
  const parentName = category.parentId
    ? (categoryByIdMap(allCategories).get(category.parentId)?.name ?? null)
    : null;

  return (
    <CategoryDetailShell
      categoryId={id}
      category={category}
      directChildCount={directChildCount}
      descendantCount={descendantCount}
      lotCount={category.usage.lots}
      saleCount={category.usage.sales}
      activityEvents={activityEvents}
      parentName={parentName}
    >
      {children}
    </CategoryDetailShell>
  );
}
