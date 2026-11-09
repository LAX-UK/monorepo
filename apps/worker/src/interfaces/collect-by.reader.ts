/** A purchased lot still waiting at a place that is set up for collection. */
export type StoredLot = {
  lotId: string;
  /** The account that bought it. */
  legalEntityId: string;
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
   * Lots whose payment cleared at or after `since` and that are still with us: not handed over,
   * ended or on their way by courier, and in no live booking.
   */
  storedLotsClearedSince(since: Date): Promise<StoredLot[]>;
}
