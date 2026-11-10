/** A purchased lot still waiting at a place that is set up for collection. */
export type StoredLot = {
  lotId: string;
  /** The account that bought it. */
  legalEntityId: string;
  /** The place it waits at. */
  venueId: string;
  /** The person who won it, who may be an agent buying for the account. */
  winnerId: string | null;
  title: string;
  lotNumber: number | null;
  /** When its payment cleared; "please collect by" counts from here. */
  clearedAt: Date;
  place: { name: string; address: string };
  /** The place's free storage period in days; null until the storage terms are set. */
  freeStorageDays: number | null;
};

/** What the storage reminders read. */
export interface ICollectByReader {
  /**
   * Lots a reminder can be due for on `today` (a London day), at places that take online bookings:
   * those whose payment cleared between the free period ago and the free period less the lead ago,
   * and that are still with us (not handed over, ended or on their way by courier, nor in a live
   * booking). The place's own free period decides the range; `defaultFreeStorageDays` stands in
   * for one that is not set.
   */
  storedLotsDue(window: {
    today: string;
    defaultFreeStorageDays: number;
    reminderLeadDays: number;
  }): Promise<StoredLot[]>;
  /**
   * The ids of the lots an earlier reminder to this person already covered: those named in the
   * outbox rows (queued, sent or failed) whose idempotency key starts with `keyPrefix`.
   */
  remindedLotIds(keyPrefix: string): Promise<Set<string>>;
}
