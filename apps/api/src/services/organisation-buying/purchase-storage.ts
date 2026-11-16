import {
  type PurchaseCollectBy,
  type PurchaseStorageView,
  type StoragePause,
  type StorageTerms,
  calculateStorageCharge,
  londonDateKey,
  purchaseStorageView,
  storageClearedOn,
} from "@auction/domain";
import type { AccountPurchaseFactsRow } from "@auction/persistence/interfaces";

type Storage = NonNullable<AccountPurchaseFactsRow["storage"]>;

/**
 * The terms a lot was sold under, in the shape the storage rules read. `null` for a lot won before
 * the first terms, which keeps the legacy notice (the place's free days, nothing charged).
 */
function termsOf(storage: Storage): StorageTerms | null {
  const sold = storage.pricing?.terms;
  if (!sold) return null;
  return {
    freeDays: sold.freeDays,
    dayCount: sold.countMode,
    standardDailyPence: sold.standardDailyPence,
    largeDailyPence: sold.largeDailyPence,
    handlingFeePence: sold.handlingFeePence,
    effectiveFrom: sold.effectiveFrom,
  };
}

/**
 * The days LAX held the work for a shipping quote it still owed (ST5): from the day the buyer asked
 * until the day it was quoted, or until `today` while it is still waiting. Open checks and disputes
 * also pause the clock, but neither is linked to a lot in the data read here yet: tracked in
 * docs/design/storage-terms.md ("Not yet built"), and it must land before charging is switched on.
 */
export function quotePausesOf(
  quote: AccountPurchaseFactsRow["quote"],
  today: string,
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

/**
 * The "please collect by" day, its legacy state and the buyer's wording for a lot sold under
 * storage terms, all from the one domain formatter. `null` when the lot has no terms (the caller
 * keeps the legacy notice) or its place has no opening calendar to count working days or move a closed
 * day with.
 */
export function purchaseStorageOf(
  storage: Storage,
  now: Date,
  quote: AccountPurchaseFactsRow["quote"] = null,
): (PurchaseCollectBy & { storage: PurchaseStorageView }) | null {
  const terms = termsOf(storage);
  const pricing = storage.pricing;
  if (!terms || !pricing || !storage.calendar) return null;
  const today = londonDateKey(now);
  const charge = calculateStorageCharge({
    terms,
    clearedOn: storageClearedOn(storage.clearedAt),
    extensionDays: pricing.extensionDays,
    waived: pricing.waived,
    pausedRanges: quotePausesOf(quote, today),
    band: pricing.large ? "large" : "standard",
    asOf: today,
    calendar: storage.calendar,
  });
  const view = purchaseStorageView(charge, terms, pricing.large ? "large" : "standard", {
    placeName: storage.placeName,
    now,
    chargingOn: pricing.chargingOn,
  });
  // A waived lot past its day stays "upcoming" here: nothing is owed, so it keeps the neutral tone
  // and its notice reads "No storage to pay".
  const passed = charge.state === "charging" || charge.state === "overdue";
  return {
    date: charge.collectBy,
    state: passed ? "overdue" : charge.state === "soon" ? "soon" : "upcoming",
    storage: view,
  };
}
