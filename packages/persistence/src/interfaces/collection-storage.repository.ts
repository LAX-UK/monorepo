/** How the days of a free period are counted. */
export type StorageCountMode = "calendar" | "working";

/** How storage charges are treated for VAT; `null` on the place until Finance chooses one. */
export type StorageVatTreatment = "standard_rated" | "zero_rated" | "exempt" | "outside_scope";

/** One version of a place's storage terms. Rates are pence per lot per day before VAT. */
export type StorageTermsRecord = {
  id: string;
  venueId: string;
  freeDays: number;
  countMode: StorageCountMode;
  standardDailyPence: number;
  /** `null`: the large band is off. */
  largeDailyPence: number | null;
  handlingFeePence: number;
  /** The first London day the terms apply, `YYYY-MM-DD`. */
  effectiveFrom: string;
  reason: string;
  createdByUserId: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
};

/** The values staff choose for a version. */
export type StorageTermsValues = Pick<
  StorageTermsRecord,
  | "freeDays"
  | "countMode"
  | "standardDailyPence"
  | "largeDailyPence"
  | "handlingFeePence"
  | "effectiveFrom"
  | "reason"
>;

/** The place's charging switch and VAT treatment. */
export type StorageChargingSettings = {
  raiseInvoices: boolean;
  vatTreatment: StorageVatTreatment | null;
};

export type StorageExtensionRecord = {
  id: string;
  lotId: string;
  days: number;
  reason: string;
  createdByUserId: string | null;
  createdAt: Date;
};

export type StorageWaiverRecord = {
  id: string;
  lotId: string;
  reason: string;
  createdByUserId: string | null;
  createdAt: Date;
};

export type StorageAuditAction =
  | "terms_scheduled"
  | "terms_edited"
  | "terms_cancelled"
  | "charging_switched"
  | "vat_treatment_set"
  | "large_flag_set"
  | "extension_granted"
  | "waiver_granted"
  | "terms_migrated";

export type StorageAuditRecord = {
  id: string;
  venueId: string;
  lotId: string | null;
  action: StorageAuditAction;
  actorUserId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  createdAt: Date;
};

/** Who changed what, and when: carried by every write. */
export type StorageChange = { actorUserId: string; at: Date };

export type ScheduleStorageTermsOutcome =
  | { outcome: "scheduled"; terms: StorageTermsRecord }
  | { outcome: "venue_not_found" }
  /** Terms start from tomorrow onward: the start date is today or earlier. */
  | { outcome: "start_not_in_future" }
  | { outcome: "date_taken" };

export type ChangeStorageTermsOutcome =
  | { outcome: "saved"; terms: StorageTermsRecord }
  | { outcome: "not_found" }
  /** The version has started (or is cancelled), so it is history and cannot change. */
  | { outcome: "not_scheduled" }
  /** Terms start from tomorrow onward: the new start date is today or earlier. */
  | { outcome: "start_not_in_future" }
  | { outcome: "date_taken" };

export type SetStorageChargingOutcome =
  | { outcome: "saved"; settings: StorageChargingSettings }
  | { outcome: "venue_not_found" }
  /** Charging cannot be switched on until a VAT treatment is chosen. */
  | { outcome: "vat_treatment_required" };

export type SetLotStorageOutcome<T> =
  | { outcome: "saved"; record: T }
  | { outcome: "lot_not_found" };

/** The most free storage days staff may add to one lot, in total across all extensions. */
export const MAX_STORAGE_EXTENSION_DAYS_PER_LOT = 30;

export type AddStorageExtensionOutcome =
  | { outcome: "saved"; record: StorageExtensionRecord }
  | { outcome: "lot_not_found" }
  /** The lot's extensions would pass the total cap; `daysRemaining` is what is left (0 or more). */
  | { outcome: "cap_reached"; daysRemaining: number };

export type AddStorageWaiverOutcome =
  | { outcome: "saved"; record: StorageWaiverRecord }
  | { outcome: "lot_not_found" }
  | { outcome: "already_waived" };

/** Per-place storage terms, per-lot extensions and waivers, and the audit of every change. */
export interface ICollectionStorageRepository {
  /** Every live version at the place, earliest start first. Cancelled versions are left out. */
  listTerms(venueId: string): Promise<StorageTermsRecord[]>;
  /** The version in force on a London day: the latest live one that has started. */
  findTermsInForce(venueId: string, on: string): Promise<StorageTermsRecord | null>;
  findTerms(termsId: string): Promise<StorageTermsRecord | null>;

  /** `today` is the London day; the start date must be after it. */
  scheduleTerms(
    venueId: string,
    values: StorageTermsValues,
    today: string,
    change: StorageChange,
  ): Promise<ScheduleStorageTermsOutcome>;
  /** Edits a version that has not started on `today`. The new start date must be after `today`. */
  editScheduledTerms(
    termsId: string,
    values: StorageTermsValues,
    today: string,
    change: StorageChange,
  ): Promise<ChangeStorageTermsOutcome>;
  /** Cancels a version that has not started on `today`. */
  cancelScheduledTerms(
    termsId: string,
    today: string,
    reason: string,
    change: StorageChange,
  ): Promise<ChangeStorageTermsOutcome>;

  /** The switch and VAT treatment, or `null` when the place has never been set up. */
  findCharging(venueId: string): Promise<StorageChargingSettings | null>;
  setVatTreatment(
    venueId: string,
    vatTreatment: StorageVatTreatment,
    reason: string,
    change: StorageChange,
  ): Promise<SetStorageChargingOutcome>;
  setRaiseInvoices(
    venueId: string,
    raiseInvoices: boolean,
    reason: string,
    change: StorageChange,
  ): Promise<SetStorageChargingOutcome>;

  /** Marks or unmarks a work as large (any side over 150 cm). A change to the same value writes nothing. */
  setLotLarge(
    lotId: string,
    large: boolean,
    reason: string | null,
    change: StorageChange,
  ): Promise<SetLotStorageOutcome<{ lotId: string; large: boolean }>>;
  /** Adds free days to one lot. All of a lot's extensions together may not pass 30 days. */
  addExtension(
    lotId: string,
    days: number,
    reason: string,
    change: StorageChange,
  ): Promise<AddStorageExtensionOutcome>;
  addWaiver(lotId: string, reason: string, change: StorageChange): Promise<AddStorageWaiverOutcome>;
  listExtensions(lotId: string): Promise<StorageExtensionRecord[]>;
  findWaiver(lotId: string): Promise<StorageWaiverRecord | null>;

  /**
   * When a sale closes: records on each of its bought lots the terms in force on `closedOn`.
   * Lots already recorded are left alone, and no terms in force records nothing. Returns the
   * number of lots recorded. Fulfilment rows created after the sale closes get the terms when
   * they are inserted (see the lot fulfilment repository), so lots paid late are covered.
   */
  recordTermsForSale(saleId: string, closedOn: string): Promise<number>;

  /** The audit of a place, newest first. */
  listAudit(venueId: string, limit: number): Promise<StorageAuditRecord[]>;
}
