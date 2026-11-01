import type { LotStatus } from "@auction/types";
import { minorUnitsToMoneyString, parseMoneyToMinorUnits } from "./money-compare.js";

/**
 * How long after an externally run (ATG) auction closes its results may still be on their way.
 * Past this, a closed auction with nothing sold is a finished result, not a pending one.
 */
export const EXTERNAL_RESULTS_SETTLING_MS = 24 * 60 * 60 * 1000;

/** The platform's currency; a sale's lots are all charged in it. */
const RESULTS_CURRENCY = "GBP";

/** The lot facts a results summary reads. The caller supplies the premium rule. */
export type SaleResultLot = {
  id: string;
  status: LotStatus;
  /** Hammer price, major units. */
  currentPrice: string;
  /** The hammer found a buyer (LAX lots). */
  hasWinner: boolean;
  /** The lot's scheduled close. */
  endTime: Date;
  /** Set when a late bid moved the close. */
  extendedUntil: Date | null;
  /** The sale is run on ATG and this is one of its lots. */
  external: boolean;
  /** For an external lot of a closed auction: it sold there. */
  externalSold: boolean;
};

export type SaleResultsSaleContext = {
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
  endTime: Date;
  /** The sale is owned by ATG and its auction is `live` or `ended` there. */
  externalState: "live" | "ended" | null;
  /** The closed external auction has reported at least one sold lot. */
  externalResultsLanded: boolean;
};

export type SaleResultsSummary =
  | {
      /** Lots are still closing or waiting for an external result: show no figures yet. */
      state: "finalising";
      pendingLotCount: number;
    }
  | {
      state: "final";
      lotCount: number;
      soldCount: number;
      currency: string;
      /** Hammer plus buyer's premium over every sold lot. */
      totalWithPremium: string;
      /** The sold lot with the highest price including premium. */
      topLot: { lotId: string; priceWithPremium: string } | null;
      /** When the last lot closed. */
      endedAt: string;
    };

type Outcome = "pending" | "sold" | "unsold" | "excluded";

function lotCloseTime(lot: SaleResultLot): Date {
  return lot.extendedUntil && lot.extendedUntil > lot.endTime ? lot.extendedUntil : lot.endTime;
}

/** Whether the sale has reached the point where its results are worth showing. */
export function saleHasResultsPhase(
  sale: Pick<SaleResultsSaleContext, "status" | "externalState">,
) {
  return sale.status === "ended" || sale.externalState === "ended";
}

function lotOutcome(lot: SaleResultLot, sale: SaleResultsSaleContext, now: Date): Outcome {
  if (lot.external) {
    if (sale.externalState === "live") return "pending";
    if (lot.externalSold) return "sold";
    const settling = now.getTime() - sale.endTime.getTime() < EXTERNAL_RESULTS_SETTLING_MS;
    return !sale.externalResultsLanded && settling ? "pending" : "unsold";
  }
  switch (lot.status) {
    case "active":
      // Still bidding, including a soft-close extension.
      return "pending";
    case "ended":
      return lot.hasWinner ? "sold" : "unsold";
    default:
      // Draft, scheduled, withdrawn and voided lots are not part of a result.
      return "excluded";
  }
}

/**
 * The results of a sale, or `null` before it has any. While any lot is still bidding or awaiting
 * an external result the state is `finalising` and carries no figures, so partial counts are never
 * published. Once every counted lot is decided it is `final`. Withdrawn and voided lots are not
 * counted. Pure: the caller reads the lots and supplies `withPremium`.
 */
export function summariseSaleResults<L extends SaleResultLot>(input: {
  sale: SaleResultsSaleContext;
  lots: readonly L[];
  now: Date;
  /** Hammer plus buyer's premium for one lot, major units. */
  withPremium: (lot: L) => string;
}): SaleResultsSummary | null {
  const { sale, lots, now } = input;
  if (!saleHasResultsPhase(sale)) return null;

  let pending = 0;
  let unsold = 0;
  let sold = 0;
  let totalMinor = 0n;
  let topMinor = -1n;
  let top: { lotId: string; priceWithPremium: string } | null = null;
  let endedAt: Date | null = null;

  for (const lot of lots) {
    const outcome = lotOutcome(lot, sale, now);
    if (outcome === "excluded") continue;
    if (outcome === "pending") {
      pending += 1;
      continue;
    }
    const close = lotCloseTime(lot);
    if (!lot.external && (!endedAt || close > endedAt)) endedAt = close;
    if (outcome === "unsold") {
      unsold += 1;
      continue;
    }
    sold += 1;
    const priceMinor = parseMoneyToMinorUnits(input.withPremium(lot));
    totalMinor += priceMinor;
    if (priceMinor > topMinor) {
      topMinor = priceMinor;
      top = { lotId: lot.id, priceWithPremium: minorUnitsToMoneyString(priceMinor) };
    }
  }

  if (pending > 0) return { state: "finalising", pendingLotCount: pending };
  return {
    state: "final",
    lotCount: sold + unsold,
    soldCount: sold,
    currency: RESULTS_CURRENCY,
    totalWithPremium: minorUnitsToMoneyString(totalMinor),
    topLot: top,
    endedAt: (endedAt ?? sale.endTime).toISOString(),
  };
}
