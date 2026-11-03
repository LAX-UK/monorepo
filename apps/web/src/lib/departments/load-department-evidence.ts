import "server-only";

import { getServerLotReader } from "@/lib/catalog/catalog.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSalesList } from "@/lib/data/http/sales.server";
import {
  DEPARTMENT_ROW_LIMIT,
  type DepartmentEvidence,
  findDepartmentCategory,
  nextConsignmentDeadline,
  onSaleWorks,
  soldWorks,
} from "@/lib/departments/department-evidence";
import { type LoadResult, settle } from "@/lib/marketing/load-result";

/** Reads past a row's limit so unsold works in the department never leave the row short. */
const SOLD_READ = DEPARTMENT_ROW_LIMIT * 3;

/**
 * What a department page can prove: works it sold, works on sale and the next consignment
 * deadline. `null` when the department has no category. A failed read gives a failed result,
 * which the page treats as nothing to show rather than as an empty department.
 */
export async function loadDepartmentEvidence(
  categorySlug: string,
  now: Date = new Date(),
): Promise<LoadResult<DepartmentEvidence | null>> {
  return settle("department evidence", async () => {
    const categories = await (await getServerCategoryReader()).list();
    const category = findDepartmentCategory(categories, categorySlug);
    if (!category) return null;

    const lotReader = await getServerLotReader();
    const [soldRows, onSaleRows, saleRows] = await Promise.all([
      lotReader.list({
        status: "ended",
        categoryId: category.id,
        sort: "endedDesc",
        limit: SOLD_READ,
      }),
      lotReader.list({
        statuses: ["active", "scheduled"],
        categoryId: category.id,
        sort: "endingAsc",
        limit: DEPARTMENT_ROW_LIMIT,
      }),
      getServerSalesList({ statuses: ["active", "scheduled"], sort: "startAsc", limit: 24 }),
    ]);

    const search = `categoryId=${encodeURIComponent(category.id)}`;
    return {
      categoryId: category.id,
      soldHref: `/results?view=lots&${search}`,
      onSaleHref: `/search?${search}`,
      sold: soldWorks(soldRows),
      onSale: onSaleWorks(onSaleRows),
      deadline: nextConsignmentDeadline(saleRows, category.id, now),
    };
  });
}
