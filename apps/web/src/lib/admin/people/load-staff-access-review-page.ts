import "server-only";

import {
  type AccessReviewSearch,
  accessReviewCounts,
  accessReviewCsvRows,
  filterAccessReview,
  parseAccessReviewFilters,
  sortAccessReview,
  toAccessReviewRows,
} from "@/lib/admin/people/staff-access-review.vm";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getServerStaffAccessReview } from "@/lib/data/http/staff-roles.server";
import {
  STAFF_ACCESS_REVIEW_ACCESS,
  USERS_DIRECTORY_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

/**
 * The access review: every staff member's roles with when each started and ends, and their last
 * sign-in, filtered by view (all, or a role ending within 30 days), role and search.
 */
export async function loadStaffAccessReviewPage(search: AccessReviewSearch) {
  const user = await requireAdminCapability(STAFF_ACCESS_REVIEW_ACCESS, "/admin/staff/access");
  const canOpenRecords = userHasAccessTo(
    user.role as UserRole,
    user.staffRoles,
    USERS_DIRECTORY_ACCESS,
  );
  const now = new Date();
  const filters = parseAccessReviewFilters(search);
  try {
    const all = await getServerStaffAccessReview();
    const shown = filterAccessReview(all, filters, now);
    return {
      filters,
      counts: accessReviewCounts(all, filters, now),
      rows: sortAccessReview(
        toAccessReviewRows(
          shown,
          now,
          canOpenRecords ? (id) => `/admin/staff/${id}` : null,
          filters.product,
        ),
        typeof search.sort === "string" ? search.sort : null,
      ),
      csv: {
        shown: accessReviewCsvRows(shown, filters.product),
        all: accessReviewCsvRows(all),
      },
      total: all.length,
      loadError: null as string | null,
    };
  } catch (error) {
    return {
      filters,
      counts: { all: 0, ending: 0 },
      rows: [],
      csv: { shown: [], all: [] },
      total: 0,
      loadError: error instanceof Error ? error.message : "The access review did not load.",
    };
  }
}

export type StaffAccessReviewPageModel = Awaited<ReturnType<typeof loadStaffAccessReviewPage>>;
