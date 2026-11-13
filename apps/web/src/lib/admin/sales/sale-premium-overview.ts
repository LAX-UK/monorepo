import type { Lot, Sale } from "@auction/types";
import {
  STANDARD_BUYER_PREMIUM,
  buyerPremiumWorkedExample,
  describeBuyerPremium,
  lotPremiumDiffersFromSale,
  saleBuyerPremiumSchedule,
  sameBuyerPremiumSchedule,
} from "@auction/validators";

/** The hammer the worked example uses: past the standard band edge, so both rates show. */
const EXAMPLE_HAMMER_MINOR = 60_000_000;

/** Lots whose premium can still change: bidding has not opened, and nobody has won them. */
const EDITABLE: ReadonlySet<Lot["status"]> = new Set(["draft", "scheduled"]);
/** Lots not yet sold: still to open, or bidding now. */
const UNSOLD: ReadonlySet<Lot["status"]> = new Set(["draft", "scheduled", "active"]);

export type DifferingLot = {
  id: string;
  /** "Lot 12 · Still life with lemons". */
  label: string;
  /** The lot's own premium in words: "25% on the hammer". */
  premium: string;
  /** Bidding has not opened, so the lot can go back on the sale's premium. */
  editable: boolean;
};

export type SalePremiumOverview = {
  /** The sale's premium in words. */
  terms: string;
  /** "On a £600,000 hammer the buyer pays £85,000 premium". */
  example: string;
  /** Whether the sale charges the standard premium in the Conditions of Sale. */
  isStandard: boolean;
  /** Unsold lots whose own premium charges something other than the sale's. */
  differingLots: DifferingLot[];
  /** The ids the bulk action changes: the differing lots whose bidding has not opened. */
  editableLotIds: string[];
};

function lotLabel(lot: Pick<Lot, "lotNumber" | "title">): string {
  return lot.lotNumber != null ? `Lot ${lot.lotNumber} · ${lot.title}` : lot.title;
}

/**
 * The sale's premium as the overview shows it, and the unsold lots that would charge something
 * else. Lots already sold keep the premium they were charged and are never listed.
 */
export function buildSalePremiumOverview(
  sale: Pick<Sale, "buyerPremiumRate" | "buyerPremiumTiers">,
  lots: readonly Pick<
    Lot,
    "id" | "lotNumber" | "title" | "status" | "winnerId" | "buyerPremiumRate"
  >[],
): SalePremiumOverview {
  const { schedule } = saleBuyerPremiumSchedule(sale);
  const differingLots = lots
    .filter((lot) => UNSOLD.has(lot.status) && !lot.winnerId)
    .filter((lot) => lotPremiumDiffersFromSale(lot.buyerPremiumRate, sale))
    .map((lot) => ({
      id: lot.id,
      label: lotLabel(lot),
      premium: describeBuyerPremium({ kind: "flat", rate: lot.buyerPremiumRate ?? "0" }),
      editable: EDITABLE.has(lot.status),
    }));
  return {
    terms: describeBuyerPremium(schedule),
    example: buyerPremiumWorkedExample(schedule, EXAMPLE_HAMMER_MINOR),
    isStandard: sameBuyerPremiumSchedule(schedule, STANDARD_BUYER_PREMIUM),
    differingLots,
    editableLotIds: differingLots.filter((lot) => lot.editable).map((lot) => lot.id),
  };
}

/** The callout's title: "3 unsold lots charge a different premium from the sale". */
export function differingLotsTitle(count: number): string {
  return count === 1
    ? "1 unsold lot charges a different premium from the sale"
    : `${count} unsold lots charge a different premium from the sale`;
}
