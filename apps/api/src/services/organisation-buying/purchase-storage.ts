import {
  type PurchaseCollectBy,
  type PurchaseStorageView,
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
 * The "please collect by" day, its legacy state and the buyer's wording for a lot sold under
 * storage terms, all from the one domain formatter. `null` when the lot has no terms (the caller
 * keeps the legacy notice) or its place has no opening calendar to count working days or move a closed
 * day with.
 */
export function purchaseStorageOf(
  storage: Storage,
  now: Date,
): (PurchaseCollectBy & { storage: PurchaseStorageView }) | null {
  const terms = termsOf(storage);
  const pricing = storage.pricing;
  if (!terms || !pricing || !storage.calendar) return null;
  const charge = calculateStorageCharge({
    terms,
    clearedOn: storageClearedOn(storage.clearedAt),
    extensionDays: pricing.extensionDays,
    waived: pricing.waived,
    // Open checks, disputes and owed quotes pause the clock; their history is not read yet.
    pausedRanges: [],
    band: pricing.large ? "large" : "standard",
    asOf: londonDateKey(now),
    calendar: storage.calendar,
  });
  const view = purchaseStorageView(charge, terms, pricing.large ? "large" : "standard", {
    placeName: storage.placeName,
    now,
    chargingOn: pricing.chargingOn,
  });
  const passed = charge.state === "charging" || charge.state === "overdue";
  return {
    date: charge.collectBy,
    state: passed ? "overdue" : charge.state === "soon" ? "soon" : "upcoming",
    storage: view,
  };
}
