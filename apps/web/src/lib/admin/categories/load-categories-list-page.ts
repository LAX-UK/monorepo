import "server-only";

import { categoriesListController } from "@/lib/admin/admin-list-controllers";
import {
  type CategoriesListSearch,
  categoriesSortState,
  sortCategoriesRows,
  toCategoriesStaffRows,
} from "@/lib/admin/categories/categories-staff-list.vm";
import { getAdminCategoriesListSummary } from "@/lib/data/http/admin.server";
import type { AdminCategoriesListSummary, AdminCategory } from "@auction/types";

/**
 * The categories list: one page of rows with the total behind it, and the taxonomy summary
 * (null when it could not load, so the page leaves the counts out instead of showing zeros).
 */
export async function loadAdminCategoriesListPage(
  query: ReturnType<typeof categoriesListController.parseQuery>,
): Promise<{
  rows: AdminCategory[];
  total: number;
  summary: AdminCategoriesListSummary | null;
  listError: string | null;
}> {
  const [listResult, summary] = await Promise.all([
    categoriesListController.fetch(query).then(
      (result) => ({ ...result, error: null as string | null }),
      (error) => ({
        rows: [] as AdminCategory[],
        total: 0,
        error: error instanceof Error ? error.message : "Could not load categories.",
      }),
    ),
    getAdminCategoriesListSummary(Boolean(query.includeArchived)).catch(() => null),
  ]);

  return {
    rows: listResult.rows,
    total: listResult.total ?? listResult.rows.length,
    summary,
    listError: listResult.error,
  };
}

/**
 * The ids of the categories the list shows for this query, in its order (the URL's sort included):
 * what a category page opened from the list pages through (Previous and Next). The same query as
 * the list, without its summary.
 */
export async function loadCategoriesListIds(sp: CategoriesListSearch): Promise<string[]> {
  const { rows } = await categoriesListController.fetch(categoriesListController.parseQuery(sp));
  return sortCategoriesRows(toCategoriesStaffRows(rows), categoriesSortState(sp.sort)).map(
    (row) => row.id,
  );
}
