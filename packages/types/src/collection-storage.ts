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

/** The band a lot is charged in: large is any side over 150 cm, marked on the lot by staff. */
export type StaffStorageBand = "standard" | "large";

/**
 * One lot past its collect-by day, still waiting at the place: the Not collected tab's row
 * (docs/design/storage-terms.md, "Not collected tab"). Money is pence before VAT.
 */
export type StaffOverdueLot = {
  lotId: string;
  lotNumber: number | null;
  title: string;
  /** The buying account's name. */
  buyerName: string;
  /** The collect-by day, extensions included: a London day. */
  collectBy: string;
  /** Calendar days since the collect-by day. */
  daysOver: number;
  band: StaffStorageBand;
  /**
   * What is owed so far under the terms the lot was sold under. Counted whether or not the place
   * raises storage invoices: while charging is off it is what would be due, and nothing is billed.
   */
  amountPence: number;
  /** "£42.00 so far (14 days at £3 a day), plus VAT where it applies."; `null` when nothing is owed. */
  amountDetail: string | null;
  /** Free days staff have added to the lot, in total. */
  extensionDays: number;
  /** Free days that may still be added (all extensions together stop at 30). */
  extensionDaysLeft: number;
  /** Finance has waived the lot's storage charges. */
  waived: boolean;
  /** 60 days or more past the collect-by day: for staff to follow up in person (ST15). */
  followUp: boolean;
  /** Won before the place had storage terms: 30 days free and nothing charged (ST9). */
  legacyTerms: boolean;
};

/** The Not collected tab's lots for one place, longest over first. */
export type StaffOverdueLots = {
  venueId: string;
  /** The London day the list was priced on. */
  today: string;
  /** The place raises storage invoices. Off, the amounts are what would be due; nothing is billed. */
  chargingOn: boolean;
  lots: StaffOverdueLot[];
  /** More lots are over than the list shows. */
  more: boolean;
};
