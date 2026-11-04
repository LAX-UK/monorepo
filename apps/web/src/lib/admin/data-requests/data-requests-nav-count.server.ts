import "server-only";

import { getAdminDataRequestSummary } from "@/lib/data/http/admin-data-requests.reader";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import {
  DATA_REQUESTS_MANAGE_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";

/**
 * The sidebar's Data requests count comes from Identity through the Bid API, not the shared nav
 * cache, and only for people who may open the page. When Identity does not answer the count is
 * left out rather than shown as zero.
 */
export async function withDataRequestsNavCount(
  counts: AdminNavCounts,
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): Promise<AdminNavCounts> {
  if (!userHasAccessTo(role, staffRoles, DATA_REQUESTS_MANAGE_ACCESS)) {
    return { ...counts, dataRequestsDueSoon: 0, dataRequestsOverdue: 0 };
  }
  const summary = await getAdminDataRequestSummary().catch(() => null);
  return {
    ...counts,
    dataRequestsDueSoon: summary?.dueSoon ?? 0,
    dataRequestsOverdue: summary?.overdue ?? 0,
  };
}
