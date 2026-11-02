import { formatLondonDateTime } from "@/lib/datetime/london-time";
import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import { type ArtistNames, homeLotCard } from "@/lib/home-sections/lot-card";
import type { HomeLotRail } from "@/lib/home-sections/types";
import { formatSaleLotsLabel } from "@/lib/sale-list-row";
import { salePath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";

export type LotRailKind = "inThisSale" | "highlightsFromNextSale" | "topLotsOfSale";

type RailCopy = {
  heading: string;
  subtitle: (sale: Sale, lots: readonly Lot[]) => string;
  seeAll: (total: number) => string;
};

/** What each rail says. One table, so the three states cannot drift apart. */
const RAIL_COPY: Record<LotRailKind, RailCopy> = {
  inThisSale: {
    heading: "More from this sale",
    subtitle: (sale) => `Bidding closes from ${formatLondonDateTime(sale.endTime)}`,
    seeAll: (total) => `View all ${formatSaleLotsLabel(total)}`,
  },
  highlightsFromNextSale: {
    heading: "Highlights from the next sale",
    subtitle: (sale) => `Estimates shown; bidding opens ${formatLondonDateTime(sale.startTime)}`,
    seeAll: (total) => `View all ${formatSaleLotsLabel(total)}`,
  },
  topLotsOfSale: {
    heading: "Top lots of the sale",
    subtitle: () => "Prices include buyer’s premium",
    seeAll: (total) => `All ${total} results`,
  },
};

/**
 * One row of lots for the lead sale, or `null` when fewer than the minimum remain once the hero
 * and the hang have taken theirs: a row is never left mostly empty.
 */
export function buildLotRail(input: {
  kind: LotRailKind;
  sale: Sale;
  lots: readonly Lot[];
  /** All lots in the sale, for the "View all" count. */
  lotCount: number;
  artistNames: ArtistNames;
  now: Date;
}): HomeLotRail | null {
  if (input.lots.length < HOME_SECTION_LIMITS.lotRail.min) return null;
  const copy = RAIL_COPY[input.kind];
  return {
    heading: copy.heading,
    subtitle: copy.subtitle(input.sale, input.lots),
    seeAll: {
      href: salePath(input.sale),
      label: copy.seeAll(Math.max(input.lotCount, input.lots.length)),
    },
    lots: input.lots.map((lot) => homeLotCard(lot, input.sale, input.artistNames, input.now)),
  };
}
