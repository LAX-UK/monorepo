import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import {
  FAILED_JOBS_READ_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";

/**
 * The sidebar's Failed jobs count comes from the shared nav-counts response (one cached count, no
 * list). The cache is shared by everyone, so it is shown only to people who may read background
 * jobs, and a response cached before the count existed reads as zero.
 */
export function withFailedJobsNavCount(
  counts: AdminNavCounts,
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): AdminNavCounts {
  const open = userHasAccessTo(role, staffRoles, FAILED_JOBS_READ_ACCESS)
    ? (counts.failedJobsNeedsReview ?? 0)
    : 0;
  return { ...counts, failedJobsNeedsReview: open };
}
