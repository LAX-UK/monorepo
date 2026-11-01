import "server-only";

import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import { fetchConsignmentInboxSummary } from "@/lib/data/http/consignment-inbox.server";
import {
  CONSIGNMENT_INBOX_READ_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";

/**
 * The sidebar's Inbox count is the person's own unanswered threads, so it comes from the inbox
 * summary (the same reader as the view tabs and the Dashboard queues), not the shared nav cache.
 */
export async function withInboxNavCount(
  counts: AdminNavCounts,
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): Promise<AdminNavCounts> {
  if (!userHasAccessTo(role, staffRoles, CONSIGNMENT_INBOX_READ_ACCESS)) {
    return { ...counts, inboxWaitingForYou: 0 };
  }
  const summary = await fetchConsignmentInboxSummary().catch(() => null);
  return { ...counts, inboxWaitingForYou: summary?.ok ? summary.data.mine.waiting : 0 };
}
