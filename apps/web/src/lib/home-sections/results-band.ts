import { atgDisplaySale } from "@/lib/catalog/atg-catalog-display";
import { formatWholeMoney } from "@/lib/format-currency";
import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import { type ArtistNames, homeLotCard } from "@/lib/home-sections/lot-card";
import type { HomeResultsBand } from "@/lib/home-sections/types";
import { RECENT_RESULTS_HREF } from "@/lib/marketing/recent-results-link";
import type { SaleListRow } from "@/lib/sale-list-row";
import { LONDON_TIME_ZONE, formatDayMonth, formatWeekday, toDate } from "@auction/datetime";
import type { LotMediaTreatmentIndex } from "@auction/domain";
import type { Lot, SaleDeliveryMode } from "@auction/types";

const DELIVERY: Record<SaleDeliveryMode, string> = {
  online: "online",
  hybrid: "online and in the room",
  onsite: "in the room",
};

function endedLabel(row: SaleListRow, now: Date): string {
  const ended = toDate(row.sale.endTime);
  const mode = DELIVERY[row.sale.deliveryMode];
  const when = ended
    ? ` ${formatWeekday(ended, LONDON_TIME_ZONE)} ${formatDayMonth(ended, LONDON_TIME_ZONE, now)}`
    : "";
  return `Ended${when}${mode ? ` · ${mode}` : ""}`;
}

/**
 * The last sale's headline figures and its top sold lots. Hidden until the figures are final and
 * something sold: a results band never shows a pending sale or a bare zero.
 */
export function buildResultsBand(input: {
  row: SaleListRow | undefined;
  /** Sold lots to show, already placed so that nothing repeats elsewhere on the page. */
  lots: readonly Lot[];
  /** Every lot read for the sale, to name the artist of its top lot. */
  saleLots: readonly Lot[];
  artistNames: ArtistNames;
  subtitle: string;
  now: Date;
  treatments?: LotMediaTreatmentIndex;
}): HomeResultsBand | null {
  const { row } = input;
  const summary = row?.resultsSummary;
  if (!row || summary?.state !== "final" || summary.soldCount === 0) return null;

  const sale = atgDisplaySale(row.sale, input.now);
  const share = Math.round((summary.soldCount / Math.max(summary.lotCount, 1)) * 100);
  const topLot = summary.topLot;
  const topLotArtist = topLot
    ? input.saleLots.find((lot) => lot.id === topLot.lotId)?.artistId
    : undefined;
  const lots = input.lots.slice(0, HOME_SECTION_LIMITS.resultsLots.max);

  return {
    subtitle: input.subtitle,
    seeAll: { href: RECENT_RESULTS_HREF, label: "All results" },
    facts: {
      saleTitle: sale.title,
      endedLabel: endedLabel(row, input.now),
      sold: {
        value: `${summary.soldCount} of ${summary.lotCount}`,
        note: `${share}% of lots`,
      },
      total: {
        value: formatWholeMoney(summary.totalWithPremium, summary.currency),
        note: "with buyer’s premium",
      },
      topLot: topLot
        ? {
            value: formatWholeMoney(topLot.priceWithPremium, summary.currency),
            note: (topLotArtist ? input.artistNames[topLotArtist] : undefined) ?? null,
          }
        : null,
    },
    lots:
      lots.length >= HOME_SECTION_LIMITS.resultsLots.min
        ? lots.map((lot) =>
            homeLotCard(lot, row.sale, input.artistNames, input.now, input.treatments),
          )
        : [],
  };
}
