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

/** The emails about waiting lots that name the lots they cover (in `vars.lotIds`). */
export type CollectionLotEmailTemplate = "collection-collect-by" | "collection-can-book";

/** What the storage reminders and the "you can book" emails read. */
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
   * Lots still waiting at places that take online bookings (as `storedLotsDue`, without the
   * deadline window) whose payment cleared at or after `since`: those the buyer may be told they
   * can book.
   */
  lotsClearedSince(since: Date): Promise<StoredLot[]>;
  /**
   * The ids of the lots an earlier email of `template` (the storage reminder unless given) to this
   * person already covered: those named in their outbox rows whose idempotency key starts with
   * `keyPrefix`. A failed row counts as covered only
   * when it was made today (a London day), so a failed email is tried again once a day, not on
   * every sweep; a queued, sent or suppressed one always counts.
   */
  remindedLotIds(query: {
    keyPrefix: string;
    userId: string;
    today: string;
    template?: CollectionLotEmailTemplate;
  }): Promise<Set<string>>;
}
