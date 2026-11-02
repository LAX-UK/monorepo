import { formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import { type CardPriceLine, cardPriceLine, lotPriceHasBids } from "@auction/domain";
import type { Lot, LotTimingSource, Sale } from "@auction/types";
import { toLotCardTimingVM } from "@auction/validators";

type LotCardLineSale =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

/** What a public card needs to say about a lot's price and clock. */
export type LotCardLineSource = Pick<
  Lot,
  | "id"
  | "status"
  | "winnerId"
  | "currentPrice"
  | "startingPrice"
  | "auctionType"
  | "buyNowPrice"
  | "marketingDetails"
> &
  LotTimingSource & {
    hasWinner?: boolean | undefined;
  };

/** The card line as plain data, so a server page can hand it to the ticking client piece. */
export type LotCardLineModel = {
  label: string;
  /** The figure as printed ("£4,200"); `null` when the lot has no price to show. */
  value: string | null;
  time: CardPriceLine["time"];
  /** ISO instants the clock counts to or from. */
  startsAt: string | null;
  endsAt: string | null;
};

function estimateOf(lot: LotCardLineSource): { low: string; high: string } | null {
  const estimate = lot.marketingDetails?.estimate;
  return estimate?.low && estimate.high ? { low: estimate.low, high: estimate.high } : null;
}

/**
 * The one price and time line for a public card: the lot page's own headline for the lot's
 * lifecycle, so the card and the page can never disagree.
 */
export function lotCardLineModel(
  lot: LotCardLineSource,
  now: Date,
  sale: LotCardLineSale = null,
): LotCardLineModel {
  const lifecycle = classifyLotLifecycle(lot, sale, now.getTime()).kind;
  const currency = lotChargeCurrency(lot);
  const line = cardPriceLine({
    lifecycle,
    bidCount: lotPriceHasBids(lot) ? 1 : 0,
    amounts: {
      starting: lot.startingPrice,
      current: lot.currentPrice,
      hammer: lifecycle === "endedSold" ? lot.currentPrice : null,
      soldForWithPremium: null,
    },
    estimate: estimateOf(lot),
    format: { money: (amount) => formatMoney(amount, currency) },
  });
  const timing = toLotCardTimingVM(lot);
  return {
    label: line.label,
    value: line.value,
    time: line.time,
    startsAt: timing.startTime,
    endsAt: timing.endTime,
  };
}
