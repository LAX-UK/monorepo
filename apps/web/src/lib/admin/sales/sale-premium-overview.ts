import { adminLotHref, adminSaleDetailTabHref } from "@/lib/admin/catalog-route-helpers";
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

/** How many differing lots the overview names; the rest are a link to the filtered lots tab. */
export const DIFFERING_LOTS_SHOWN = 5;

/** The lots tab's query that keeps only lots charging their own premium. */
export const OWN_PREMIUM_QUERY = "premium=own";

type PremiumLot = Pick<Lot, "status" | "winnerId" | "buyerPremiumRate">;

/**
 * An unsold lot that charges its own premium, different from its sale's. The overview warning
 * and the lots tab's "Own premium" filter both use this, so the count and the list agree.
 */
export function lotChargesOwnPremium(
  lot: PremiumLot,
  sale: Pick<Sale, "buyerPremiumRate" | "buyerPremiumTiers">,
): boolean {
  return (
    UNSOLD.has(lot.status) && !lot.winnerId && lotPremiumDiffersFromSale(lot.buyerPremiumRate, sale)
  );
}

export type DifferingLot = {
  id: string;
  /** "Lot 12 · Still life with lemons". */
  label: string;
  /** The lot's own premium in words: "25% on the hammer". */
  premium: string;
  /** Bidding has not opened, so the lot can go back on the sale's premium. */
  editable: boolean;
  /** The lot's staff page. */
  href: string;
};

export type SalePremiumOverview = {
  /** The sale's premium in words. */
  terms: string;
  /** "On a £600,000 hammer the buyer's premium is £85,000." */
  example: string;
  /** Whether the sale charges the standard premium in the Conditions of Sale. */
  isStandard: boolean;
  /** Unsold lots whose own premium charges something other than the sale's. */
  differingLots: DifferingLot[];
  /** The first few differing lots, which the warning names. */
  shownLots: DifferingLot[];
  /** The differing lots not named, with a link to all of them on the lots tab; `null` when none. */
  more: { count: number; href: string } | null;
  /** The ids the bulk action changes: the differing lots whose bidding has not opened. */
  editableLotIds: string[];
  /** How many differing lots are open for bidding and keep their premium. */
  openCount: number;
};

function lotLabel(lot: Pick<Lot, "lotNumber" | "title">): string {
  return lot.lotNumber != null ? `Lot ${lot.lotNumber} · ${lot.title}` : lot.title;
}

/**
 * The sale's premium as the overview shows it, and the unsold lots that would charge something
 * else. Lots already sold keep the premium they were charged and are never listed.
 */
export function buildSalePremiumOverview(
  sale: Pick<Sale, "id" | "buyerPremiumRate" | "buyerPremiumTiers">,
  lots: readonly Pick<
    Lot,
    "id" | "lotNumber" | "title" | "status" | "winnerId" | "buyerPremiumRate"
  >[],
): SalePremiumOverview {
  const { schedule } = saleBuyerPremiumSchedule(sale);
  const differingLots = lots
    .filter((lot) => lotChargesOwnPremium(lot, sale))
    .map((lot) => ({
      id: lot.id,
      label: lotLabel(lot),
      premium: describeBuyerPremium({ kind: "flat", rate: lot.buyerPremiumRate ?? "0" }),
      editable: EDITABLE.has(lot.status),
      href: adminLotHref(lot.id),
    }));
  const hidden = differingLots.length - DIFFERING_LOTS_SHOWN;
  const editableLotIds = differingLots.filter((lot) => lot.editable).map((lot) => lot.id);
  return {
    terms: describeBuyerPremium(schedule),
    example: buyerPremiumWorkedExample(schedule, EXAMPLE_HAMMER_MINOR),
    isStandard: sameBuyerPremiumSchedule(schedule, STANDARD_BUYER_PREMIUM),
    differingLots,
    shownLots: differingLots.slice(0, DIFFERING_LOTS_SHOWN),
    more:
      hidden > 0
        ? { count: hidden, href: `${adminSaleDetailTabHref(sale.id, "lots")}?${OWN_PREMIUM_QUERY}` }
        : null,
    editableLotIds,
    openCount: differingLots.length - editableLotIds.length,
  };
}

function lotsWord(count: number): string {
  return count === 1 ? "1 lot" : `${count} lots`;
}

/** The bulk action's button, naming how many lots it changes: "Use the sale's premium for 2 lots". */
export function salePremiumActionLabel(count: number): string {
  return `Use the sale's premium for ${lotsWord(count)}`;
}

/** "and 7 more", the link to the rest of the differing lots. */
export function moreLotsLabel(count: number): string {
  return `and ${count} more`;
}

/** Why some listed lots are left out of the action: they are open for bidding. */
export function openLotsNote(openCount: number): string | null {
  if (openCount === 0) return null;
  return openCount === 1
    ? "1 lot is open for bidding and keeps its premium."
    : `${openCount} lots are open for bidding and keep their premium.`;
}

/** What someone who may not edit lots can do about them. */
export const READ_ONLY_NEXT_STEP = "Ask a cataloguer to set these lots to the sale's premium.";

/** The callout's title: "3 unsold lots charge a different premium from the sale". */
export function differingLotsTitle(count: number): string {
  return count === 1
    ? "1 unsold lot charges a different premium from the sale"
    : `${count} unsold lots charge a different premium from the sale`;
}
