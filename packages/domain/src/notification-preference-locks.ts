import type { NotificationPreference } from "@auction/types";

/**
 * Alerts that protect a bid or a payment stay on: the outbid email (a bid can still be saved)
 * and the won email (it carries the invoice and how to pay). Settings show them as locked
 * switches with this reason, and saving never turns them off. Extend the table, not the callers.
 */
export const LOCKED_NOTIFICATION_PREFERENCES = [
  "outbidEmail",
  "wonEmail",
] as const satisfies readonly (keyof NotificationPreference)[];

export type LockedNotificationPreference = (typeof LOCKED_NOTIFICATION_PREFERENCES)[number];

export const LOCKED_NOTIFICATION_PREFERENCE_REASON =
  "Required while you're bidding: outbid and win emails stay on, so you never miss a bid or a payment.";

const LOCKED = new Set<string>(LOCKED_NOTIFICATION_PREFERENCES);

export function notificationPreferenceLocked(field: string): field is LockedNotificationPreference {
  return LOCKED.has(field);
}

/** A preference change with every locked alert held on, whatever was asked. */
export function withLockedPreferencesOn<T extends Partial<Record<string, unknown>>>(patch: T): T {
  const next: Record<string, unknown> = { ...patch };
  for (const field of LOCKED_NOTIFICATION_PREFERENCES) {
    if (field in next) next[field] = true;
  }
  return next as T;
}
