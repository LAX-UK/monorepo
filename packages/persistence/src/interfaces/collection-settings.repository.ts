import type {
  CollectionExceptionSource,
  CollectionRules,
  CollectionWeeklyHours,
  DateKey,
  ExceptionDraft,
} from "@auction/domain";
import type { DbTransaction } from "./artist-delete.repository.js";
import type { CollectionPlaceSettings } from "./collection-booking.repository.js";

/** A closure or extra opening as staff see it. Sale days are worked out, so they have no id. */
export type StaffExceptionRecord = {
  /** `null` for a sale day: it is not stored and cannot be removed, only opened anyway. */
  id: string | null;
  kind: "closure" | "extra_opening";
  startsOn: DateKey;
  endsOn: DateKey;
  opensLocal: string | null;
  closesLocal: string | null;
  source: CollectionExceptionSource;
  /** Staff's own note; never shown to clients. */
  reasonInternal: string | null;
  saleId: string | null;
  saleTitle: string | null;
  createdByUserId: string | null;
  createdAt: Date | null;
};

export type StaffSettingsRecord = {
  settings: CollectionPlaceSettings;
  hours: CollectionWeeklyHours[];
  /** Stored closures and openings plus the sale days, earliest first. */
  exceptions: StaffExceptionRecord[];
  /** The next sale at the place that closes collections, if any. */
  nextSaleDay: { saleId: string; saleTitle: string; startsOn: DateKey } | null;
};

/** A place staff can set up. */
export type CollectionVenueChoice = {
  venueId: string;
  name: string;
  /** Set up already, or still on the defaults. */
  hasPlace: boolean;
  onlineBookingEnabled: boolean;
};

export interface ICollectionSettingsReader {
  /** Every active venue, so staff can pick the place they are setting up. */
  venues(): Promise<CollectionVenueChoice[]>;
  /**
   * A place's settings, hours and closures from `range.from` on, creating the place with the
   * gallery's defaults and adding the bank holidays it lacks. `null` when the venue is unknown.
   */
  read(
    venueId: string,
    range: { from: DateKey; to: DateKey },
    now?: Date,
  ): Promise<StaffSettingsRecord | null>;
}

/** The names of the settings that a save changed. Names only: they go into the audit log. */
export type SettingsField =
  | "online_booking_enabled"
  | "visit_minutes"
  | "places_per_slot"
  | "notice_cutoff"
  | "notice_working_days"
  | "window_days"
  | "close_on_sale_days"
  | "undo_hand_over_minutes"
  | "max_active_visits"
  | "free_storage_days"
  | "storage_charge"
  | "booking_email"
  | "weekly_hours";

export type SaveCollectionSettings = {
  venueId: string;
  /** The `updatedAt` of the settings as staff last read them; another value means someone else saved. */
  expectedUpdatedAt: Date;
  rules: CollectionRules;
  onlineBookingEnabled: boolean;
  bookingEmail: string | null;
  freeStorageDays: number | null;
  storageChargePence: number | null;
  hours: readonly CollectionWeeklyHours[];
  updatedByUserId: string;
  at: Date;
};

export type SaveSettingsOutcome =
  | {
      outcome: "saved";
      settings: CollectionPlaceSettings;
      hours: CollectionWeeklyHours[];
      changed: SettingsField[];
    }
  /** Someone else saved since staff read the settings. */
  | { outcome: "stale" }
  /** The guard refused: the visits the change affects are not the ones staff were shown. */
  | { outcome: "affected_changed" }
  | { outcome: "venue_not_found" };

export type AddCollectionException = {
  venueId: string;
  draft: ExceptionDraft;
  reasonInternal: string | null;
  createdByUserId: string;
};

export type AddExceptionOutcome =
  | { outcome: "added"; exception: StaffExceptionRecord }
  | { outcome: "affected_changed" }
  | { outcome: "venue_not_found" };

export type RemoveCollectionException = {
  venueId: string;
  exceptionId: string;
  at: Date;
};

export type RemoveExceptionOutcome =
  | { outcome: "removed"; exception: StaffExceptionRecord }
  | { outcome: "affected_changed" }
  | { outcome: "not_found" };

/** Work done inside the transaction of a change, such as writing the audit event. */
export type WithinSettingsTransaction<T> = (tx: DbTransaction, result: T) => Promise<void>;

/**
 * Checked inside the transaction of a change, after the place is locked and before anything is
 * written: true to go ahead, false to stop with `affected_changed`. Staff changes use it to check
 * again that the visits they would affect are the ones staff were shown, under the lock that
 * stops a booking being made in the meantime.
 */
export type GuardSettingsTransaction = (tx: DbTransaction) => Promise<boolean>;

export interface ICollectionSettingsWriter {
  save(
    input: SaveCollectionSettings,
    within?: WithinSettingsTransaction<Extract<SaveSettingsOutcome, { outcome: "saved" }>>,
    guard?: GuardSettingsTransaction,
  ): Promise<SaveSettingsOutcome>;
  addException(
    input: AddCollectionException,
    within?: WithinSettingsTransaction<StaffExceptionRecord>,
    guard?: GuardSettingsTransaction,
  ): Promise<AddExceptionOutcome>;
  removeException(
    input: RemoveCollectionException,
    within?: WithinSettingsTransaction<StaffExceptionRecord>,
    guard?: GuardSettingsTransaction,
  ): Promise<RemoveExceptionOutcome>;
}
