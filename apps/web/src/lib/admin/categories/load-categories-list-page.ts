import "server-only";

import { categoriesListController } from "@/lib/admin/admin-list-controllers";
import { getAdminCategoriesListSummary, getAdminCategoryList } from "@/lib/data/http/admin.server";
import type { AdminCategoriesListSummary, AdminCategory } from "@auction/types";

const EMPTY_SUMMARY: AdminCategoriesListSummary = {
  totalCount: 0,
  activeCount: 0,
  archivedCount: 0,
  usageTotals: { lots: 0, sales: 0, submissions: 0 },
  mostUsedCategory: null,
};

export async function loadAdminCategoriesListPage(
  query: ReturnType<typeof categoriesListController.parseQuery>,
): Promise<{
  rows: AdminCategory[];
  total: number;
  summary: AdminCategoriesListSummary;
  categoryTree: AdminCategory[];
  listError: string | null;
}> {
  const [listResult, summary, categoryTree] = await Promise.all([
    categoriesListController.fetch(query).then(
      (result) => ({ ...result, error: null as string | null }),
      (error) => ({
        rows: [] as AdminCategory[],
        total: 0,
        error: error instanceof Error ? error.message : "Could not load categories.",
      }),
    ),
    getAdminCategoriesListSummary(Boolean(query.includeArchived)).catch(() => EMPTY_SUMMARY),
    getAdminCategoryList({ includeArchived: true }).catch(() => []),
  ]);

  return {
    rows: listResult.rows,
    total: listResult.total ?? listResult.rows.length,
    summary,
    categoryTree,
    listError: listResult.error,
  };
}
