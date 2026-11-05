/** The caller's open transaction; the application layer never sees the database type. */
export type ShopAlertErasureTx = unknown;

/** What one erasure changed. Counts only; never any address. */
export type ShopAlertErasureCounts = {
  /** Alert engine subscribers deleted, for Shop and lax.art (topics, matches and digests go too). */
  alertSubscribers: number;
  /** Subscribers kept as a suppression because the address complained about a mail. */
  suppressionsKept: number;
};

export type ShopAlertErasureTarget = {
  /** Addresses as held or typed; implementations normalise them (trim, lower-case). */
  emails: readonly string[];
  /** Accounts whose subscriptions go too, whatever address they hold. */
  subjectIds?: readonly string[];
};

/**
 * Erases the email-only alert subscriptions Shop and lax.art hold for an address. Runs in the
 * caller's transaction, so it commits or rolls back with the erasure around it. Safe to repeat.
 */
export interface ShopAlertSubscriberErasure {
  erase(tx: ShopAlertErasureTx, target: ShopAlertErasureTarget): Promise<ShopAlertErasureCounts>;
}
