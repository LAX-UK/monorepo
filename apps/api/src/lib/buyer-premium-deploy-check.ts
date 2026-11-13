import type { BuyerPremiumSchedule } from "@auction/types";
import {
  type BuyerPremiumSaleTerms,
  formatPremiumPercent,
  isBuyerPremiumRate,
  lotPremiumDiffersFromSale,
  resolveBuyerPremium,
  saleBuyerPremiumSchedule,
  sameBuyerPremiumSchedule,
} from "@auction/validators";

/*
 * The pre-deploy check for the clause 11 release (migration 0380). Before it, a sale's bands
 * always won and a lot's own rate was read only in a sale without bands. After it, a lot's own
 * rate wins. The migration clears the rate of every lot in a sale with bands, invoiced or not, so
 * nothing is repriced: not a live lot, not a sold lot awaiting its invoice, and not an invoiced
 * lot whose invoice is later voided (a buyer default re-prices it afresh). This check proves it,
 * lot by lot.
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

/** The lot rate migration 0380 leaves: cleared for every lot in a sale with bands. */
export function lotRateAfterMigration0380(
  lot: Pick<PremiumCheckLot, "lotRate">,
  sale: BuyerPremiumSaleTerms | null,
): string | null {
  return saleHasBands(sale) ? null : lot.lotRate;
}

function saleHasBands(sale: BuyerPremiumSaleTerms | null): boolean {
  return Boolean(sale?.buyerPremiumTiers && sale.buyerPremiumTiers.length > 0);
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
 * by slice is the clause 11 fix itself. `preDeploy` applies migration 0380's change first, for a
 * run against the database before the migration. A lot with no legacy rate (written by the new
 * release without a premium of its own, in a sale without bands) was never priced by the old
 * release, so it cannot have changed: see `checkPremiumLot`'s `noLegacyRate`.
 */
export function premiumChangedAtDeploy(
  lot: PremiumCheckLot,
  sale: BuyerPremiumSaleTerms | null,
  opts: { preDeploy: boolean },
): LockedPremiumReason | null {
  const reason = lockedPremiumReason(lot);
  if (!reason) return null;
  const legacy = legacyBuyerPremiumSchedule(lot.lotRate, sale);
  if (!legacy) return null;
  const { schedule } = resolveBuyerPremium({ lotRate: rateCharged(lot, sale, opts), sale });
  return sameBuyerPremiumSchedule(legacy, schedule) ? null : reason;
}

/** The lot rate the release reads: as stored, or as migration 0380 leaves it with `preDeploy`. */
function rateCharged(
  lot: Pick<PremiumCheckLot, "lotRate">,
  sale: BuyerPremiumSaleTerms | null,
  opts: { preDeploy: boolean },
): string | null {
  return opts.preDeploy ? lotRateAfterMigration0380(lot, sale) : lot.lotRate;
}

/** What the check reports for one lot. */
export type PremiumLotCheck = {
  /** The lot rate the release reads (after migration 0380 with `preDeploy`). */
  lotRate: string | null;
  /** Locked lots (live, sold not invoiced) the release would charge differently: blocks. */
  changed: LockedPremiumReason | null;
  /** The lot has no rate the old release could have charged; it uses its sale's flat rate. */
  noLegacyRate: boolean;
  /** An unsold lot that has not opened whose own premium differs from its sale's (staff to check). */
  differsFromSale: boolean;
  /**
   * `preDeploy` only: a lot in a sale with bands that would still hold a rate differing from the
   * bands after the migration. Any lot counts, invoiced too: a voided invoice re-prices the lot
   * from its rate. Blocks the deploy.
   */
  bandedOverride: boolean;
};

const UNOPENED = new Set(["draft", "scheduled"]);

/** The whole check for one lot. Invoiced lots are not repriced: only `bandedOverride` applies. */
export function checkPremiumLot(
  lot: PremiumCheckLot,
  sale: BuyerPremiumSaleTerms | null,
  opts: { preDeploy: boolean },
): PremiumLotCheck {
  const lotRate = rateCharged(lot, sale, opts);
  const bandedOverride =
    opts.preDeploy &&
    sale !== null &&
    saleHasBands(sale) &&
    lotPremiumDiffersFromSale(lotRate, sale);
  if (lot.hasLiveInvoice) {
    return { lotRate, changed: null, noLegacyRate: false, differsFromSale: false, bandedOverride };
  }
  return {
    lotRate,
    changed: premiumChangedAtDeploy(lot, sale, opts),
    noLegacyRate: legacyBuyerPremiumSchedule(lot.lotRate, sale) === null,
    differsFromSale:
      UNOPENED.has(lot.status) &&
      !lot.hasWinner &&
      sale !== null &&
      lotPremiumDiffersFromSale(lotRate, sale),
    bandedOverride,
  };
}

/** The counts the check ends with. */
export type PremiumCheckTotals = {
  changed: number;
  differsFromSale: number;
  bandedOverride: number;
};

/**
 * The script's exit status. Before the deploy (`preDeploy`) only lots the release would reprice
 * block it: locked lots charged differently, and lots in a sale with bands still holding a
 * different rate. A lot whose own premium differs from its sale's (in a sale without bands, where
 * the old release charged it too) is for staff to review, not a reason to stop the deploy. Without
 * `preDeploy`, a run against the live database also fails on those, so staff see them.
 */
export function premiumCheckExitCode(
  totals: PremiumCheckTotals,
  opts: { preDeploy: boolean },
): 0 | 1 {
  if (totals.changed > 0 || totals.bandedOverride > 0) return 1;
  if (!opts.preDeploy && totals.differsFromSale > 0) return 1;
  return 0;
}

/**
 * A notice for a sale without bands: it charges one flat rate on the whole hammer, which for a
 * sale written outside the app (15% default) is not the standard's 10% above £500,000.
 */
export function saleWithoutBandsNotice(sale: BuyerPremiumSaleTerms): string | null {
  if (saleHasBands(sale)) return null;
  return `no bands: charges a flat ${formatPremiumPercent(sale.buyerPremiumRate)} on the whole hammer`;
}
