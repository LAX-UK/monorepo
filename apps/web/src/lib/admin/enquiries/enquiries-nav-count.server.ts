import "server-only";

import { enquiriesNavCount } from "@/lib/admin/enquiries/enquiries.vm";
import { enquiryAbilities } from "@/lib/admin/enquiries/enquiry-access";
import { getAdminEnquiries } from "@/lib/data/http/admin-enquiries.reader";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import { ENQUIRIES_ACCESS, type StaffRoles, type UserRole, userHasAccessTo } from "@auction/types";

const NONE = { enquiriesWaiting: 0, enquiriesLate: 0 } as const;

/**
 * The sidebar's Enquiries count: new enquiries on this person's own queue, plus the unassigned
 * ones for people who triage. It comes from the Bid API per person, not the shared nav cache, and
 * is left out rather than shown as zero when the API does not answer.
 */
export async function withEnquiriesNavCount(
  counts: AdminNavCounts,
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): Promise<AdminNavCounts> {
  if (!userHasAccessTo(role, staffRoles, ENQUIRIES_ACCESS)) return { ...counts, ...NONE };
  const { canWork, defaultView } = enquiryAbilities({ role, staffRoles });
  const views =
    defaultView === "assigned_to_me" || !canWork
      ? ["assigned_to_me"]
      : ["assigned_to_me", "unassigned"];
  const pages = await Promise.all(
    views.map((view) =>
      getAdminEnquiries(new URLSearchParams({ view, limit: "100" })).catch(() => null),
    ),
  );
  if (pages.some((page) => page === null)) return { ...counts, ...NONE };
  const items = pages.flatMap((page) => page?.items ?? []);
  const { waiting, late } = enquiriesNavCount(items, new Date());
  return { ...counts, enquiriesWaiting: waiting, enquiriesLate: late };
}
