import "server-only";

import { purchaseProblemsApiQuery } from "@/lib/admin/purchase-problems/purchase-problems-search";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminPurchaseProblems } from "@/lib/data/http/admin-purchase-problems.reader";
import {
  PURCHASE_PROBLEMS_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";

/**
 * The sidebar's Purchase problems count: reports nobody has taken on yet. It comes from the Bid
 * API, not the shared nav cache, and only for people who may open the page. It is left out rather
 * than shown as zero when the API does not answer.
 */
export async function withPurchaseProblemsNavCount(
  counts: AdminNavCounts,
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): Promise<AdminNavCounts> {
  if (!userHasAccessTo(role, staffRoles, PURCHASE_PROBLEMS_ACCESS)) {
    return { ...counts, purchaseProblemsOpen: 0 };
  }
  const page = await getAdminPurchaseProblems(
    purchaseProblemsApiQuery({ status: "open", q: "", saleId: "", assignee: "", page: 1 }, 1),
  ).catch(() => null);
  return { ...counts, purchaseProblemsOpen: page?.counts.open ?? 0 };
}
