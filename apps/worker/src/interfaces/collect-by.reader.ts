import type { WaitingLotStorage } from "@auction/persistence/lib";

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
  place: {
    name: string;
    address: string;
    /** The place's collections email, when it has its own; the gallery's otherwise. */
    bookingEmail?: string | null;
    /** The venue's phone from its details; null when none is set. Never a placeholder. */
    phone?: string | null;
  };
  /**
   * What prices its storage: the terms it was sold under, its band, extensions, waiver, the
   * buyer's courier quote, the place's charging switch and opening calendar. Read for the storage
   * reminders; `undefined` where a read does not need it (the "you can book" email).
   */
  storage?: WaitingLotStorage | undefined;
};

/** The emails about waiting lots that name the lots they cover (in `vars.lotIds`). */
export type CollectionLotEmailTemplate =
  | "collection-collect-by"
  | "collection-storage-charges"
  | "collection-can-book";

/** What the storage reminders and the "you can book" emails read. */
export interface ICollectByReader {
  /**
   * Every lot still waiting at a place that takes online bookings (not handed over, ended or on its
   * way by courier, nor in a live booking) whose payment cleared on or before `today` (a London
   * day), with what prices its storage. The storage rules then decide which reminder, if any, each
   * lot is due: the deadline depends on the terms it was sold under, its extensions and the days
   * LAX held it, so it is not narrowed in SQL.
   */
  storedLotsWaiting(query: { today: string }): Promise<StoredLot[]>;
  /**
   * Lots still waiting at places that take online bookings (as `storedLotsWaiting`, without
   * what prices their storage) whose payment cleared at or after `since`: those the buyer may be told they
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
