import { lotPath } from "@/lib/seo/url";
import type { UserNotification } from "@auction/types";

const STAFF_SUBMISSION_NOTIFICATION_TYPES = new Set(["submission_received_for_review"]);

/** Administrators review role changes on the staff access page; the person has no link. */
const STAFF_ACCESS_NOTIFICATION_TYPES = new Set([
  "staff_role_expired_admin",
  "staff_role_changed_admin",
]);

/** A lot's delivery notices open the buyer's purchases, where its fulfilment is tracked. */
const FULFILMENT_NOTIFICATION_TYPES = new Set([
  "lot_ready_for_collection",
  "lot_shipped",
  "lot_delivered",
]);

/** Notices about the organisation itself open the page where the person acts on them. */
const PAGE_BY_TYPE: Readonly<Record<string, string>> = {
  delivery_quote_ready: "/purchases",
  access_requested: "/team",
  organisation_member_left: "/team",
  payout_problem: "/organisation/payouts",
  payout_bank_changed: "/organisation/payouts",
};

/** Primary deep link for an inbox row (submission detail preferred over lot page). */
export function notificationHref(item: UserNotification): string | null {
  if (STAFF_ACCESS_NOTIFICATION_TYPES.has(item.type)) return "/admin/staff/access";
  if (FULFILMENT_NOTIFICATION_TYPES.has(item.type)) return "/purchases";
  const page = PAGE_BY_TYPE[item.type];
  if (page) return page;
  // A message on a consignment opens its thread: the account's Messages tab, or, for the
  // specialist (a notice outside any account), the submission in Bid admin.
  if (item.submissionId && item.type === "consignment_message") {
    return item.legalEntityId
      ? `/selling/consignments/${item.submissionId}?tab=messages`
      : `/admin/submissions/${item.submissionId}`;
  }
  if (item.submissionId && STAFF_SUBMISSION_NOTIFICATION_TYPES.has(item.type)) {
    return `/admin/submissions/${item.submissionId}`;
  }
  if (item.submissionId) return `/selling/consignments/${item.submissionId}`;
  if (item.lotId) return lotPath({ id: item.lotId, title: item.title });
  return null;
}
