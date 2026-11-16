import {
  type PurchaseCollectBy,
  type PurchaseStorageView,
  type StoragePause,
  calculateStorageCharge,
  londonDateKey,
  purchaseStorageView,
  storageClearedOn,
  storageTermsForLot,
} from "@auction/domain";
import type { AccountPurchaseFactsRow } from "@auction/persistence/interfaces";

type Storage = NonNullable<AccountPurchaseFactsRow["storage"]>;

/** What prices a lot that has no pricing read: no extension, no waiver, standard band, charging off. */
const NO_PRICING = {
  terms: null,
  large: false,
  extensionDays: 0,
  waived: false,
  chargingOn: false,
};

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
 * The "please collect by" day, its legacy state and the buyer's wording for a lot, all from the one
 * domain formatter. A lot sold before its place had terms is held under `LEGACY_STORAGE_TERMS`
 * (30 calendar days free, nothing charged: ST9) through the same rules. `null` only when the
 * lot's place has no opening calendar to count working days or move a closed day with, or its
 * stored terms cannot be priced; the caller then keeps today's notice, so one bad row never fails
 * the purchases list.
 */
export function purchaseStorageOf(
  storage: Storage,
  now: Date,
  quote: AccountPurchaseFactsRow["quote"] = null,
): (PurchaseCollectBy & { storage: PurchaseStorageView }) | null {
  if (!storage.calendar) return null;
  const pricing = storage.pricing ?? NO_PRICING;
  const terms = storageTermsForLot(pricing.terms);
  const band = pricing.large ? "large" : "standard";
  const today = londonDateKey(now);
  try {
    const charge = calculateStorageCharge({
      terms,
      clearedOn: storageClearedOn(storage.clearedAt),
      extensionDays: pricing.extensionDays,
      waived: pricing.waived,
      pausedRanges: quotePausesOf(quote, today),
      band,
      asOf: today,
      calendar: storage.calendar,
    });
    const view = purchaseStorageView(charge, terms, band, {
      placeName: storage.placeName,
      now,
      chargingOn: pricing.chargingOn,
    });
    // A waived lot past its day stays "upcoming" here: nothing is owed, so it keeps the neutral
    // tone and its notice reads "No storage to pay".
    const passed = charge.state === "charging" || charge.state === "overdue";
    return {
      date: charge.collectBy,
      state: passed ? "overdue" : charge.state === "soon" ? "soon" : "upcoming",
      storage: view,
    };
  } catch (err) {
    console.error("[purchaseStorageOf] storage terms could not be priced", {
      placeId: storage.placeId,
      err,
    });
    return null;
  }
}
