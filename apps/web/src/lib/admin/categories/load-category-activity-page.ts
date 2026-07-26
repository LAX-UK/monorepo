import "server-only";

import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

export type CategoryActivityPageModel = {
  categoryId: string;
  events: Awaited<ReturnType<typeof getAdminDomainEventsForAggregate>>;
};

/** Data/composition boundary for `/admin/categories/[id]/activity`. */
export async function loadAdminCategoryActivityPage(
  categoryId: string,
): Promise<CategoryActivityPageModel> {
  await loadAdminCategoryDetail(categoryId);
  const events = await getAdminDomainEventsForAggregate({
    aggregateType: "category",
    aggregateId: categoryId,
    limit: 100,
  }).catch(() => []);

  return { categoryId, events };
}
