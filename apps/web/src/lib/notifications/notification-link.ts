import { lotPath } from "@/lib/seo/url";
import type { UserNotification } from "@auction/types";

const STAFF_SUBMISSION_NOTIFICATION_TYPES = new Set(["submission_received_for_review"]);

/** Administrators review role changes on the staff access page; the person has no link. */
const STAFF_ACCESS_NOTIFICATION_TYPES = new Set([
  "staff_role_expired_admin",
  "staff_role_changed_admin",
]);

/** Primary deep link for an inbox row (submission detail preferred over lot page). */
export function notificationHref(item: UserNotification): string | null {
  if (STAFF_ACCESS_NOTIFICATION_TYPES.has(item.type)) return "/admin/staff/access";
  if (item.submissionId && STAFF_SUBMISSION_NOTIFICATION_TYPES.has(item.type)) {
    return `/admin/submissions/${item.submissionId}`;
  }
  if (item.submissionId) return `/selling/consignments/${item.submissionId}`;
  if (item.lotId) return lotPath({ id: item.lotId, title: item.title });
  return null;
}
