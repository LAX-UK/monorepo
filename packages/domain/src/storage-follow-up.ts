import { DEFAULT_COLLECT_BY_POLICY } from "./collection-storage.js";
import { type DateKey, addDaysToKey, daysBetweenKeys, londonDateKey } from "./collection-time.js";
import {
  type StorageBand,
  type StorageCalendar,
  type StorageCharge,
  type StoragePause,
  type StorageTerms,
  calculateStorageCharge,
  storageClearedOn,
  storageTermsForLot,
} from "./storage-terms.js";

/** After the "Storage charges have started" email, a running total goes this often, in days (ST15). */
export const STORAGE_TOTAL_EVERY_DAYS = 14;

/** The most free days staff may add to one lot, across all its extensions (ST10). */
export const MAX_STORAGE_EXTENSION_DAYS = 30;

/** Days past the collect-by day after which staff see a lot flagged for personal follow-up (ST15). */
export const STORAGE_FOLLOW_UP_DAYS = 60;

/** What prices one lot's storage beyond where it waits: its terms, band, extensions and waiver. */
export type LotStorageFacts = {
  /** The terms recorded when its sale closed; `null` for a lot won before the first terms. */
  terms: StorageTerms | null;
  /** Staff marked the work large (any side over 150 cm). */
  large: boolean;
  /** Free days staff added, in total. */
  extensionDays: number;
  /** Finance waived the charges on this lot. */
  waived: boolean;
};

/** A courier quote on a lot, as far as the storage clock is concerned. */
export type StorageQuoteHold = {
  status: string;
  requestedAt: Date;
  quotedAt: Date | null;
};

/**
 * The days LAX held the work for a shipping quote it still owed (ST5): from the day the buyer asked
 * until the day it was quoted, or until `today` while it is still waiting. Open checks and disputes
 * also pause the clock, but neither is linked to a lot in the data read for storage yet: tracked in
 * docs/design/storage-terms.md ("Not yet built"), and it must land before charging is switched on.
 */
export function storageQuotePauses(
  quote: StorageQuoteHold | null | undefined,
  today: DateKey,
): StoragePause[] {
  if (!quote) return [];
  const from = londonDateKey(quote.requestedAt);
  if (quote.status === "requested") return from <= today ? [{ from, to: today }] : [];
  if ((quote.status === "quoted" || quote.status === "accepted") && quote.quotedAt) {
    const to = londonDateKey(quote.quotedAt);
    return from <= to ? [{ from, to }] : [];
  }
  return [];
}

export type LotStorageCharge = {
  /** The terms the lot is held under: those recorded at sale close, else the legacy terms. */
  terms: StorageTerms;
  band: StorageBand;
  charge: StorageCharge;
};

/**
 * One lot's storage on `asOf`, through `calculateStorageCharge` under the terms it was sold under
 * (`storageTermsForLot`). Every reader of a lot's storage (the buyer pages, the reminder emails and
 * the staff Not collected tab) prices it here, so they cannot disagree. Throws, as the calculator
 * does, on terms the rules cannot price.
 */
export function lotStorageCharge(input: {
  facts: LotStorageFacts;
  clearedAt: Date;
  pausedRanges: readonly StoragePause[];
  calendar: StorageCalendar;
  asOf: DateKey;
}): LotStorageCharge {
  const terms = storageTermsForLot(input.facts.terms);
  const band: StorageBand = input.facts.large ? "large" : "standard";
  const charge = calculateStorageCharge({
    terms,
    clearedOn: storageClearedOn(input.clearedAt),
    extensionDays: input.facts.extensionDays,
    waived: input.facts.waived,
    pausedRanges: input.pausedRanges,
    band,
    asOf: input.asOf,
    calendar: input.calendar,
  });
  return { terms, band, charge };
}

/**
 * The storage emails a buyer is sent about one lot (ST15): a week before the collect-by day
 * (`lead`), on the day (`day`), "Storage charges have started" the day after (`started`), then a
 * running total every 14 days (`total`).
 */
export type StorageReminderKind = "lead" | "day" | "started" | "total";

export type StorageReminder = {
  kind: StorageReminderKind;
  /** The collect-by day the reminder is about; a new day (an extension) is a new reminder. */
  collectBy: DateKey;
  /**
   * Which run of 14 days since charges started: 0 for `started`, 1 and on for each `total`, and 0
   * before the day. With the kind and the day, it names the reminder once, however often a sweep runs.
   */
  cycle: number;
};

/**
 * The storage reminder one lot is due on `today`, or none. Each is due over a stretch of days, not
 * one day, so a sweep that missed a day still sends it: the early reminder from a week before the
 * day until the day before; the reminder on the day only; "started" in the first 14 days of charges
 * and each running total over the 14 days after its own. Keyed by kind, day and cycle, it goes once.
 *
 * Nothing goes for a waived lot (there is nothing to pay), and nothing after the day for a lot that
 * owes nothing (no rate for its band, the legacy terms, or every day held). While the place does
 * not raise storage invoices, the day after still sends one email in the approved "charges may
 * apply" wording, and no running total goes: there is nothing billed to total.
 */
export function storageReminderFor(
  lot: LotStorageCharge & { extensionDays: number },
  today: DateKey,
  chargingOn: boolean,
): StorageReminder | null {
  const { charge, terms, extensionDays } = lot;
  if (charge.state === "waived") return null;
  const { collectBy, chargingFrom } = charge;
  if (today === collectBy) return { kind: "day", collectBy, cycle: 0 };
  if (today < collectBy) {
    const { reminderLeadDays } = DEFAULT_COLLECT_BY_POLICY;
    // A free period no longer than the lead has no early reminder: it would fall on or before the
    // day payment cleared.
    const early = terms.freeDays + extensionDays > reminderLeadDays;
    return early && today >= addDaysToKey(collectBy, -reminderLeadDays)
      ? { kind: "lead", collectBy, cycle: 0 }
      : null;
  }
  if (charge.state !== "charging") return null;
  const cycle = Math.floor(daysBetweenKeys(chargingFrom, today) / STORAGE_TOTAL_EVERY_DAYS);
  if (cycle === 0) return { kind: "started", collectBy, cycle };
  return chargingOn ? { kind: "total", collectBy, cycle } : null;
}

/** Calendar days since the collect-by day: 0 on or before it. */
export function storageDaysOver(charge: Pick<StorageCharge, "collectBy">, today: DateKey): number {
  return Math.max(0, daysBetweenKeys(charge.collectBy, today));
}

/** The lot has waited long enough past its day that staff should follow it up in person (ST15). */
export function needsStorageFollowUp(daysOver: number): boolean {
  return daysOver >= STORAGE_FOLLOW_UP_DAYS;
}
