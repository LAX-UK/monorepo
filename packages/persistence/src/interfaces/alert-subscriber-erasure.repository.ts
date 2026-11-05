import type { Database } from "@auction/db";

/** Whose email-only alert subscriptions to erase: addresses, and the accounts that own rows. */
export type AlertSubscriberErasureTarget = {
  /** Addresses as typed; the repository normalises them (trim, lower-case). */
  emails: readonly string[];
  /** Accounts whose subscriptions go too (account deletion), whatever address they hold. */
  userIds?: readonly string[];
};

/** What one erasure changed. Counts only; never any address. */
export type AlertSubscriberErasureCounts = {
  /** Alert engine subscribers deleted (topics, matches and digests go with them). */
  alertSubscribers: number;
  /** Email-only new-sale alert subscribers deleted. */
  visitorSaleAlerts: number;
  /**
   * Alert subscribers kept as a suppression because the address complained about a mail: erasing
   * the row would let it be mailed again.
   */
  suppressionsKept: number;
};

/**
 * Erases LAX Bid's alert subscriptions for an address. Safe to run again: nothing left to erase
 * counts as zero. Bid's tables only; Shop and lax.art erase their own.
 */
export interface IAlertSubscriberErasureRepository {
  eraseInTransaction(
    tx: Database,
    target: AlertSubscriberErasureTarget,
  ): Promise<AlertSubscriberErasureCounts>;
}
