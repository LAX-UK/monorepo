/**
 * What Bid admin's Storage tab reads and sends (docs/design/storage-terms.md, "Staff screens").
 * Money is integer pence before VAT; days are London days, `YYYY-MM-DD`.
 */

/** How free storage days are counted. The same values as the domain's `StorageCountMode`. */
export type StaffStorageCountMode = "calendar" | "working";

/** How storage charges are treated for VAT; `null` until Finance chooses one. */
export type StaffStorageVatTreatment = "standard_rated" | "zero_rated" | "exempt" | "outside_scope";

/** One version of a place's storage terms. */
export type StaffStorageTerms = {
  id: string;
  /** The first London day the terms apply. */
  effectiveFrom: string;
  freeDays: number;
  countMode: StaffStorageCountMode;
  standardDailyPence: number;
  /** `null`: the large band is off and large works pay the standard rate. */
  largeDailyPence: number | null;
  handlingFeePence: number;
  /** Why the version was set, as staff wrote it. */
  reason: string;
};

/** The place's "Raise storage invoices" switch. */
export type StaffStorageCharging = {
  raiseInvoices: boolean;
  vatTreatment: StaffStorageVatTreatment | null;
};

/** A change to the place's storage, as the History table lists it. */
export type StaffStorageHistoryAction =
  | "terms_scheduled"
  | "terms_edited"
  | "terms_cancelled"
  | "charging_switched"
  | "vat_treatment_set"
  | "terms_migrated";

/** One History row: when, who, and the change with what it was before and after, and why. */
export type StaffStorageHistoryEntry = {
  id: string;
  /** ISO instant. */
  at: string;
  action: StaffStorageHistoryAction;
  /** The staff member's name; `null` when the change was made by the system or the name is gone. */
  who: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
};

/** Everything the Storage tab shows for one collection place. */
export type StaffStorageSettings = {
  venueId: string;
  /** The London day the page was read on; a change may start from the day after. */
  today: string;
  /** The terms in force today; `null` when the place has never had any. */
  inForce: StaffStorageTerms | null;
  /** The next change, if one is scheduled. A place has at most one waiting at a time. */
  scheduled: StaffStorageTerms | null;
  charging: StaffStorageCharging;
  /** Changes to the place's terms and switch, newest first. */
  history: StaffStorageHistoryEntry[];
};
