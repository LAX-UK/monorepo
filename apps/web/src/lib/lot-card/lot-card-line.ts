import { formatWholeMoney, lotChargeCurrency } from "@/lib/format-currency";
import { soldPriceWithPremium } from "@/lib/hang/hang-label";
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
  | "buyerPremiumRate"
> &
  Partial<Pick<Lot, "checkoutPricing">> &
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

/** The buyer's price of a sold lot: the server's total when it sent one, else hammer plus premium. */
function soldForWithPremium(
  lot: LotCardLineSource,
  lifecycle: string,
  tiers: Sale["buyerPremiumTiers"] | undefined,
): string | null {
  if (lifecycle !== "endedSold") return null;
  if (lot.checkoutPricing) return lot.checkoutPricing.totalMajor;
  if (tiers === undefined && lot.buyerPremiumRate == null) return null;
  return soldPriceWithPremium(lot, { buyerPremiumTiers: tiers ?? null });
}

/** Whether a status badge still earns its place: the line already says anything with a clock. */
export function lotCardShowsStatusBadge(model: LotCardLineModel): boolean {
  return model.time === "ended" || model.time === "none";
}

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
  opts: {
    /** The parent sale, when known, so the lifecycle knows about the room. */
    sale?: LotCardLineSale;
    /** The sale's premium tiers, so a sold lot reads the buyer's price, as the lot page does. */
    premiumTiers?: Sale["buyerPremiumTiers"];
  } = {},
): LotCardLineModel {
  const sale = opts.sale ?? null;
  const lifecycle = classifyLotLifecycle(lot, sale, now.getTime()).kind;
  const currency = lotChargeCurrency(lot);
  const line = cardPriceLine({
    lifecycle,
    bidCount: lotPriceHasBids(lot) ? 1 : 0,
    amounts: {
      starting: lot.startingPrice,
      current: lot.currentPrice,
      hammer: lifecycle === "endedSold" ? lot.currentPrice : null,
      soldForWithPremium: soldForWithPremium(lot, lifecycle, opts.premiumTiers),
    },
    estimate: estimateOf(lot),
    // Cards print whole pounds; invoices and receipts keep their pence elsewhere.
    format: { money: (amount) => formatWholeMoney(amount, currency) },
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
