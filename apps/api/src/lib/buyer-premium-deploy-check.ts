import type { BuyerPremiumSchedule } from "@auction/types";
import {
  type BuyerPremiumSaleTerms,
  isBuyerPremiumRate,
  resolveBuyerPremium,
  saleBuyerPremiumSchedule,
  sameBuyerPremiumSchedule,
} from "@auction/validators";

/*
 * The pre-deploy check for the clause 11 release (migration 0375). Before it, a sale's bands
 * always won and a lot's own rate was read only in a sale without bands. After it, a lot's own
 * rate wins. The migration clears the rate of uninvoiced lots in a sale with bands so nothing is
 * repriced; this check proves it, lot by lot, for the lots whose premium can no longer be fixed
 * by staff: lots open for bidding, and lots sold but not yet invoiced.
 */

/** A lot as the check sees it. */
export type PremiumCheckLot = {
  status: string;
  hasWinner: boolean;
  hasLiveInvoice: boolean;
  /** `lot.buyer_premium_rate` as stored. */
  lotRate: string | null;
};

/** Why a lot's premium can no longer be changed by staff, or `null` when it still can be. */
export type LockedPremiumReason = "live" | "sold_not_invoiced";

/** The premium the release before clause 11 charged: the sale's bands if any, else the lot's rate. */
export function legacyBuyerPremiumSchedule(
  lotRate: string | null,
  sale: BuyerPremiumSaleTerms | null,
): BuyerPremiumSchedule | null {
  if (sale) {
    const { source, schedule } = saleBuyerPremiumSchedule(sale);
    if (source === "sale_bands") return schedule;
  }
  return isBuyerPremiumRate(lotRate) ? { kind: "flat", rate: lotRate } : null;
}

/** The lot rate migration 0375 leaves: cleared for an uninvoiced lot in a sale with bands. */
export function lotRateAfterMigration0375(
  lot: Pick<PremiumCheckLot, "lotRate" | "hasLiveInvoice">,
  sale: BuyerPremiumSaleTerms | null,
): string | null {
  const banded = Boolean(sale?.buyerPremiumTiers && sale.buyerPremiumTiers.length > 0);
  return banded && !lot.hasLiveInvoice ? null : lot.lotRate;
}

/** Lots whose premium staff can no longer change and that have no invoice to read it from. */
export function lockedPremiumReason(lot: PremiumCheckLot): LockedPremiumReason | null {
  if (lot.hasLiveInvoice) return null;
  if (lot.status === "active") return "live";
  if (lot.status === "ended" && lot.hasWinner) return "sold_not_invoiced";
  return null;
}

/**
 * Whether a lot whose premium is locked would be charged under a different premium than the old
 * release charged it. Bands compared with the same bands count as unchanged: charging them slice
 * by slice is the clause 11 fix itself. `preDeploy` applies migration 0375's change first, for a
 * run against the database before the migration.
 */
export function premiumChangedAtDeploy(
  lot: PremiumCheckLot,
  sale: BuyerPremiumSaleTerms | null,
  opts: { preDeploy: boolean },
): LockedPremiumReason | null {
  const reason = lockedPremiumReason(lot);
  if (!reason) return null;
  const legacy = legacyBuyerPremiumSchedule(lot.lotRate, sale);
  const lotRate = opts.preDeploy ? lotRateAfterMigration0375(lot, sale) : lot.lotRate;
  const { schedule } = resolveBuyerPremium({ lotRate, sale });
  return legacy && sameBuyerPremiumSchedule(legacy, schedule) ? null : reason;
}
