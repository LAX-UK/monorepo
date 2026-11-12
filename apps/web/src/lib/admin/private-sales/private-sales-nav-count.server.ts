import "server-only";

import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminDealsAttentionCount } from "@/lib/data/http/admin-private-sales.reader";
import {
  PRIVATE_SALE_DEALS_READ_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";

const NONE = { privateSalesAttention: 0, privateSalesUrgent: 0 } as const;

/**
 * The sidebar's Private sales count: settled deals whose artwork the register does not show as
 * sold, cut to the deals this person may see (the owner's own, or all for those who run every
 * deal). It comes from the Bid API per person, not the shared nav cache, and is left out rather
 * than shown as zero when the API does not answer.
 */
export async function withPrivateSalesNavCount(
  counts: AdminNavCounts,
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): Promise<AdminNavCounts> {
  if (!userHasAccessTo(role, staffRoles, PRIVATE_SALE_DEALS_READ_ACCESS)) {
    return { ...counts, ...NONE };
  }
  const attention = await getAdminDealsAttentionCount().catch(() => null);
  if (!attention) return { ...counts, ...NONE };
  return {
    ...counts,
    privateSalesAttention: attention.total,
    privateSalesUrgent: attention.urgent,
  };
}
