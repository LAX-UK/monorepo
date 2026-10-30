/**
 * Notifications that ask the person to do something, shown in the inbox's "Needs action" view
 * while they are unread and not archived. Extend the table, not the callers.
 *
 * An outbid notice needs action only while its lot is still open: once the lot has closed there
 * is nothing left to do.
 */
export const NOTIFICATION_NEEDS_ACTION_TYPES = [
  "outbid",
  "payment_due",
  "consignment_agreement_reminder",
  "submission_changes_requested",
  "kyc_resubmission_required",
  "source_of_funds_documents_requested",
] as const;

export type NotificationNeedsActionType = (typeof NOTIFICATION_NEEDS_ACTION_TYPES)[number];

/** Types whose action ends when their lot closes. */
export const NOTIFICATION_NEEDS_ACTION_WHILE_LOT_OPEN: readonly NotificationNeedsActionType[] = [
  "outbid",
];

export function notificationNeedsAction(type: string): type is NotificationNeedsActionType {
  return (NOTIFICATION_NEEDS_ACTION_TYPES as readonly string[]).includes(type);
}
