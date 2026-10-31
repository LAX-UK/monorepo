import { NEEDS_YOU_NOTIFICATION_TYPES } from "./needs-you.js";

/**
 * Notifications that ask the person to do something, shown in the inbox's "Needs action" view
 * while they are unread and not archived. They are exactly the notifications that announce a
 * "Needs you" task (`announcedBy` in `needs-you.ts`), so the inbox, Home and the sidebar counts
 * read one table and never disagree. Extend that table, not the callers.
 *
 * An outbid notice needs action only while its lot is still open: once the lot has closed there
 * is nothing left to do.
 */
export const NOTIFICATION_NEEDS_ACTION_TYPES: readonly string[] = NEEDS_YOU_NOTIFICATION_TYPES;

/** Types whose action ends when their lot closes. */
export const NOTIFICATION_NEEDS_ACTION_WHILE_LOT_OPEN: readonly string[] = ["outbid"];

const NEEDS_ACTION = new Set<string>(NOTIFICATION_NEEDS_ACTION_TYPES);

export function notificationNeedsAction(type: string): boolean {
  return NEEDS_ACTION.has(type);
}
