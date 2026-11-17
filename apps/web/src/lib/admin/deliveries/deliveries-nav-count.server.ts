import "server-only";

import { getAdminDeliveriesWaitingCount } from "@/lib/data/http/admin-deliveries.reader";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import {
  DELIVERIES_READ_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";

/**
 * The sidebar's Deliveries count: buyers waiting for a delivery price (NAV-3). It comes from the
 * Bid API's counts-only endpoint, only for people who may open the page, and is left out rather
 * than shown wrong when the API does not answer.
 */
export async function withDeliveriesNavCount(
  counts: AdminNavCounts,
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): Promise<AdminNavCounts> {
  if (!userHasAccessTo(role, staffRoles, DELIVERIES_READ_ACCESS)) {
    return { ...counts, deliveriesWaiting: 0 };
  }
  const waiting = await getAdminDeliveriesWaitingCount().catch(() => null);
  return { ...counts, deliveriesWaiting: waiting ?? 0 };
}
