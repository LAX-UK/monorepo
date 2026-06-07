import { lotPath } from "@/lib/seo/url";
import type { UserNotification } from "@auction/types";

const STAFF_SUBMISSION_NOTIFICATION_TYPES = new Set(["submission_received_for_review"]);

/** Primary deep link for an inbox row (submission detail preferred over lot page). */
export function notificationHref(item: UserNotification): string | null {
  if (item.submissionId && STAFF_SUBMISSION_NOTIFICATION_TYPES.has(item.type)) {
    return `/admin/submissions/${item.submissionId}`;
  }
  if (item.submissionId) return `/dashboard/submissions/${item.submissionId}`;
  if (item.lotId) return lotPath({ id: item.lotId, title: item.title });
  return null;
}
