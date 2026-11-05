import "server-only";

import {
  type PurchaseProblemsFilters,
  type PurchaseProblemsSearch,
  hasPurchaseProblemsFilters,
  parsePurchaseProblemsSearch,
  purchaseProblemsApiQuery,
  purchaseProblemsPagination,
} from "@/lib/admin/purchase-problems/purchase-problems-search";
import {
  getAdminPurchaseProblems,
  getPurchaseProblemAssignees,
} from "@/lib/data/http/admin-purchase-problems.reader";
import type {
  PurchaseProblemAssignee,
  PurchaseProblemListPage,
} from "@/lib/data/http/admin-purchase-problems.schema";

export type PurchaseProblemsPageModel = {
  filters: PurchaseProblemsFilters;
  filtered: boolean;
  page: PurchaseProblemListPage | null;
  assignees: PurchaseProblemAssignee[];
  pagination: ReturnType<typeof purchaseProblemsPagination> | null;
  loadError: string | null;
};

/** Data and composition boundary for `/admin/purchase-problems`. */
export async function loadAdminPurchaseProblemsPage(
  sp: PurchaseProblemsSearch,
): Promise<PurchaseProblemsPageModel> {
  const filters = parsePurchaseProblemsSearch(sp);
  const [page, assignees] = await Promise.allSettled([
    getAdminPurchaseProblems(purchaseProblemsApiQuery(filters)),
    getPurchaseProblemAssignees(),
  ]);
  const base = {
    filters,
    filtered: hasPurchaseProblemsFilters(filters),
    assignees: assignees.status === "fulfilled" ? assignees.value : [],
  };
  if (page.status === "rejected") {
    const message = page.reason instanceof Error ? page.reason.message : "";
    return {
      ...base,
      page: null,
      pagination: null,
      loadError:
        message === "forbidden"
          ? "You do not have access to purchase problems."
          : "The Bid API didn't answer. Reports are still being kept; try again in a moment.",
    };
  }
  return {
    ...base,
    page: page.value,
    pagination: purchaseProblemsPagination(sp, page.value),
    loadError: null,
  };
}
