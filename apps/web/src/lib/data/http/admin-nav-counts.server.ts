import "server-only";

import {
  type AdminNavCounts,
  EMPTY_ADMIN_NAV_COUNTS,
} from "@/lib/data/http/admin-nav-counts.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { cache } from "react";

/** Loads staff sidebar badge counts from a single admin API endpoint. */
export const getAdminNavCounts = cache(async (): Promise<AdminNavCounts> => {
  try {
    const res = await authedServerFetch("/admin/nav-counts");
    if (!res.ok) return EMPTY_ADMIN_NAV_COUNTS;
    const json = (await res.json()) as { data?: AdminNavCounts };
    return json.data ?? EMPTY_ADMIN_NAV_COUNTS;
  } catch {
    return EMPTY_ADMIN_NAV_COUNTS;
  }
});

/** Finance-shell badge counts (subset of full platform nav counts). */
export const getFinanceAdminNavCounts = cache(async (): Promise<AdminNavCounts> => {
  const counts = await getAdminNavCounts();
  return {
    ...EMPTY_ADMIN_NAV_COUNTS,
    manualReviewCount: counts.manualReviewCount,
    disputesOpen: counts.disputesOpen,
    payoutsFailed: counts.payoutsFailed,
  };
});

export type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
export { EMPTY_ADMIN_NAV_COUNTS };
