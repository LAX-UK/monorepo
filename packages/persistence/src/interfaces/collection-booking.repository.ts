import type {
  CollectionBookingStatus,
  CollectionException,
  CollectionIdType,
  CollectionRules,
  CollectionWeeklyHours,
  CollectorKind,
  DateKey,
} from "@auction/domain";
import type { DbTransaction } from "./artist-delete.repository.js";

/** The rules a place sets, with the online-booking switch and the contact address. */
export type CollectionPlaceSettings = CollectionRules & {
  venueId: string;
  onlineBookingEnabled: boolean;
  /** Days a bought work is stored free; `null` until the storage terms are set. */
  freeStorageDays: number | null;
  bookingEmail: string | null;
  updatedAt: Date;
};

/** Everything the slot generator needs for one place and one run of days. */
export type CollectionCalendarFacts = {
  settings: CollectionPlaceSettings;
  hours: CollectionWeeklyHours[];
  exceptions: CollectionException[];
};

/** Reading and starting a place's collection settings. */
export interface ICollectionPlaceRepository {
  /**
   * The place's settings, created with the gallery's defaults (Monday to Friday 10:00 to 19:00,
   * online booking off) the first time anything needs them. Safe to call concurrently.
   */
  ensure(venueId: string): Promise<CollectionPlaceSettings>;
  /** The settings, or `null` when the place has never been set up. Creates nothing. */
  find(venueId: string): Promise<CollectionPlaceSettings | null>;
  /**
   * The settings and weekly hours of the place a lot is collected from (its sale's venue), or
   * `null` when the lot has no sale or venue, or the place has not been set up. Creates nothing.
   */
  /** The venue's name and address on one line, for the calendar file; `null` if it has none. */
  findAddress(venueId: string): Promise<{ name: string; address: string } | null>;
  findForLot(
    lotId: string,
  ): Promise<{ settings: CollectionPlaceSettings; hours: CollectionWeeklyHours[] } | null>;
  /**
   * The hours and the exceptions that touch `from` to `to` (inclusive London days), with the
   * settings. Exceptions removed by staff are left out.
   */
  readCalendarFacts(
    venueId: string,
    range: { from: DateKey; to: DateKey },
    now?: Date,
  ): Promise<CollectionCalendarFacts>;
}

/** Who is collecting, as stored. Personal data of someone who may have no account. */
export type CollectionCollectorRecord = {
  kind: CollectorKind;
  name: string;
  email: string | null;
  company: string | null;
  /** The collector's own account, when they are a member who has one. */
  userId: string | null;
};

export type CollectionBookingLotRecord = {
  lotId: string;
  /** True while the booking is live and holds the lot. */
  active: boolean;
  outcome: "collected" | "left" | null;
};

export type CollectionBookingRecord = {
  id: string;
  /** "COL-1000" upwards. */
  reference: string;
  legalEntityId: string;
  venueId: string;
  slotStart: Date;
  slotEnd: Date;
  seat: number;
  status: CollectionBookingStatus;
  bookedByUserId: string | null;
  bookedVia: "client" | "staff";
  overCapacity: boolean;
  overCapacityReason: string | null;
  collector: CollectionCollectorRecord;
  authorisedByUserId: string | null;
  authorisedAt: Date | null;
  policyVersion: string | null;
  /** The calendar entry's SEQUENCE; goes up with every change and the cancellation. */
  icsSequence: number;
  idCheckType: CollectionIdType | null;
  outcomeByUserId: string | null;
  outcomeAt: Date | null;
  cancelledByUserId: string | null;
  cancelledAt: Date | null;
  personalDetailsErasedAt: Date | null;
  lots: CollectionBookingLotRecord[];
  createdAt: Date;
  updatedAt: Date;
};

/** The details stored for who collects, and who authorised a third party. */
export type CollectionCollectorInput = {
  kind: CollectorKind;
  name: string;
  email: string | null;
  company: string | null;
  userId: string | null;
  /** For a third party: the account holder who authorised them, and when. */
  authorisedByUserId: string | null;
  authorisedAt: Date | null;
  policyVersion: string | null;
};

export type NewCollectionBooking = {
  legalEntityId: string;
  venueId: string;
  slotStart: Date;
  slotEnd: Date;
  /** Places at once in the slot; a booking within capacity takes the first free one up to this. */
  placesPerSlot: number;
  /** Staff only: take a place beyond capacity, with the reason. */
  overCapacityReason: string | null;
  lotIds: readonly string[];
  collector: CollectionCollectorInput;
  bookedByUserId: string | null;
  bookedVia: "client" | "staff";
  /** Chosen by the client for this attempt; a repeat of it returns the same booking. */
  idempotencyKey: string;
};

export type BookingOutcome =
  | { outcome: "booked"; booking: CollectionBookingRecord }
  /** The same key was sent before with the same request: this is that booking, unchanged. */
  | { outcome: "replayed"; booking: CollectionBookingRecord }
  /** The key was used before for a different request (the API answers 409 idempotency_key_reused). */
  | { outcome: "key_reused" }
  /** Every place in the slot is taken. */
  | { outcome: "slot_full" }
  /** At least one lot is already in a live booking. */
  | { outcome: "lot_taken"; lotIds: string[] };

export type ChangeCollectionBooking = {
  bookingId: string;
  /** The booking's SEQUENCE as the caller read it; a different value means someone else changed it. */
  expectedSequence: number;
  slotStart: Date;
  slotEnd: Date;
  placesPerSlot: number;
  overCapacityReason: string | null;
  lotIds: readonly string[];
  collector: CollectionCollectorInput;
};

export type ChangeOutcome =
  | { outcome: "changed"; booking: CollectionBookingRecord }
  | { outcome: "not_found" }
  /** The booking is no longer live, or its SEQUENCE moved on. */
  | { outcome: "stale" }
  | { outcome: "slot_full" }
  | { outcome: "lot_taken"; lotIds: string[] };

export type CancelCollectionBooking = {
  bookingId: string;
  expectedSequence: number;
  cancelledByUserId: string | null;
  at: Date;
};

export type CancelOutcome =
  | { outcome: "cancelled"; booking: CollectionBookingRecord }
  | { outcome: "not_found" }
  | { outcome: "stale" };

/**
 * Work to do inside the transaction that stores a change, once it has succeeded: the audit event
 * goes here, so a booking and its record in the audit log stand or fall together. If it throws,
 * the change is rolled back.
 */
export type WithinBookingTransaction = (
  tx: DbTransaction,
  booking: CollectionBookingRecord,
) => Promise<void>;

/** Making, changing and cancelling a booking. */
export interface ICollectionBookingWriter {
  /**
   * Books a visit. Two requests racing for the last place cannot both win: each takes the first
   * free numbered place in the slot, and the database refuses a second claim on the same one.
   * Nothing is stored unless the place and every lot are won together.
   */
  book(input: NewCollectionBooking, within?: WithinBookingTransaction): Promise<BookingOutcome>;
  /**
   * Moves a live booking to another slot, lots or collector. The new place is claimed first and
   * the old one is released by the same statement, so a failed change keeps the old time.
   */
  change(input: ChangeCollectionBooking, within?: WithinBookingTransaction): Promise<ChangeOutcome>;
  /** Inside `tx` when staff cancel as part of a larger change; otherwise in its own transaction. */
  cancel(
    input: CancelCollectionBooking,
    within?: WithinBookingTransaction,
    tx?: DbTransaction,
  ): Promise<CancelOutcome>;
}

export type RecordHandOver = {
  bookingId: string;
  /** Lots handed over; the booking's other live lots are left behind. */
  handedOverLotIds: readonly string[];
  idCheckType: CollectionIdType;
  staffUserId: string;
  at: Date;
};

export type HandOverOutcome =
  | {
      outcome: "handed_over";
      booking: CollectionBookingRecord;
      handedOverLotIds: string[];
      leftLotIds: string[];
    }
  | { outcome: "not_found" }
  /** The booking is no longer live. */
  | { outcome: "stale" }
  /** A lot named is not in the booking. */
  | { outcome: "lot_not_in_booking"; lotIds: string[] };

export type MarkNotCollected = { bookingId: string; staffUserId: string; at: Date };

export type NotCollectedOutcome =
  | { outcome: "marked"; booking: CollectionBookingRecord }
  | { outcome: "not_found" }
  | { outcome: "stale" };

export type UndoHandOver = {
  bookingId: string;
  /** Staff may put a booking back over the usual capacity; the place is the first free one. */
  at: Date;
};

export type UndoOutcome =
  | { outcome: "undone"; booking: CollectionBookingRecord }
  | { outcome: "not_found" }
  /** The booking is not handed over. */
  | { outcome: "stale" }
  /** A lot left behind has been booked again since. */
  | { outcome: "lot_taken"; lotIds: string[] };

/** What happens at the desk. */
export interface ICollectionOutcomeWriter {
  /** `within` runs in the same transaction once the change has succeeded: the audit event goes there. */
  recordHandOver(
    input: RecordHandOver,
    within?: WithinBookingTransaction,
  ): Promise<HandOverOutcome>;
  markNotCollected(
    input: MarkNotCollected,
    within?: WithinBookingTransaction,
  ): Promise<NotCollectedOutcome>;
  undoHandOver(input: UndoHandOver, within?: WithinBookingTransaction): Promise<UndoOutcome>;
}

/** Reading bookings. */
export interface ICollectionBookingReader {
  findById(bookingId: string): Promise<CollectionBookingRecord | null>;
  /** Whether the account has already made a booking with this idempotency key. */
  hasIdempotencyKey(legalEntityId: string, key: string): Promise<boolean>;
  findByReference(reference: string): Promise<CollectionBookingRecord | null>;
  /** The account's bookings, newest visit first. */
  listForAccount(legalEntityId: string, limit: number): Promise<CollectionBookingRecord[]>;
  /** How many visits the account has booked and not yet had, cancelled or missed. */
  countBooked(legalEntityId: string): Promise<number>;
  /** Bookings whose visit starts in [from, to), earliest first, with every status; inside `tx` when the caller is holding a transaction open. */
  listInRange(
    venueId: string,
    range: { from: Date; to: Date },
    tx?: DbTransaction,
  ): Promise<CollectionBookingRecord[]>;
  /** The place's bookings in these statuses, newest visit first, up to `limit`. */
  listByStatus(
    venueId: string,
    statuses: readonly CollectionBookingStatus[],
    limit: number,
  ): Promise<CollectionBookingRecord[]>;
  /**
   * How many missed visits at this place nobody has followed up: marked not collected, and none
   * of their lots in a live booking since. A count, so a tab can show it without reading the list.
   */
  countOpenNotCollected(venueId: string): Promise<number>;
  /** How many bookings, at any place, are still booked for a visit starting in [from, to). */
  countBookedInRange(range: { from: Date; to: Date }): Promise<number>;
  /**
   * The live booking holding each of these lots, if any. Keyed by lot id; a lot in no live booking
   * is absent.
   */
  findLiveByLots(lotIds: readonly string[]): Promise<Map<string, CollectionBookingRecord>>;
  /** Places taken by live bookings, keyed by the visit's start in epoch milliseconds. */
  takenPlaces(venueId: string, range: { from: Date; to: Date }): Promise<Map<number, number>>;
}
