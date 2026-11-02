import { formatLondonMoment } from "@/lib/datetime/london-time";
import { lotChargeCurrency } from "@/lib/format-currency";
import { formatHangMoney } from "@/lib/hang/hang-money";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotWasSold } from "@/lib/lot/lot-outcome";
import { lotHeadlineLabel, lotPriceHasBids } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";
import { buildBuyerPremiumPolicy, majorToMinor, minorToMajor } from "@auction/validators";

/** Everything a wall label prints, as plain data: the page decides how it looks. */
export type HangLabelModel = {
  eyebrow: string;
  title: string;
  price: { qualifier?: string; value: string } | undefined;
  notes: string[];
  /** Set while the lot can still take bids, so the label may follow the live price. */
  live: { lotId: string; currency: string } | undefined;
};

export type HangLabelContext = {
  sale: Pick<Sale, "buyerPremiumTiers"> | null;
  now: Date;
  /** Add "Shown framed" when the photograph shows a frame we have no size for. */
  shownFramed?: boolean;
};

/** The hammer plus the buyer's premium: what the buyer paid, which is what a result shows. */
export function soldPriceWithPremium(
  lot: Pick<Lot, "currentPrice" | "buyerPremiumRate">,
  sale: Pick<Sale, "buyerPremiumTiers"> | null,
): string {
  const policy = buildBuyerPremiumPolicy({
    saleTiers: sale?.buyerPremiumTiers ?? null,
    lotRate: lot.buyerPremiumRate,
  });
  const hammerMinor = majorToMinor(lot.currentPrice);
  return minorToMajor(hammerMinor + policy.computePremiumMinor(hammerMinor));
}

function lotEyebrow(lot: Pick<Lot, "lotNumber" | "id">): string {
  if (lot.lotNumber != null) return `Lot ${lot.lotNumber}`;
  return `Lot ${lot.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

type PriceAndNotes = Pick<HangLabelModel, "price" | "notes" | "live">;

function endedLabel(lot: Lot, ctx: HangLabelContext, currency: string): PriceAndNotes {
  if (lotWasSold(lot)) {
    return {
      price: {
        qualifier: "Sold for",
        value: formatHangMoney(soldPriceWithPremium(lot, ctx.sale), currency),
      },
      notes: [],
      live: undefined,
    };
  }
  return { price: { value: "Not sold" }, notes: [], live: undefined };
}

function biddingLabel(lot: Lot, ctx: HangLabelContext, currency: string): PriceAndNotes {
  const live = { lotId: lot.id, currency };
  const closes = `Closes ${formatLondonMoment(lot.endTime, ctx.now)}`;
  if (lot.status === "active") {
    return {
      price: {
        qualifier: lotHeadlineLabel("live", lotPriceHasBids(lot)),
        value: formatHangMoney(
          lotPriceHasBids(lot) ? lot.currentPrice : lot.startingPrice,
          currency,
        ),
      },
      notes: [closes],
      live,
    };
  }
  // Scheduled: an estimate says more than an opening bid when staff have set one.
  const estimate = lotEstimateLine(lot);
  return {
    price: estimate
      ? { qualifier: "Estimate", value: estimate }
      : {
          qualifier: lotHeadlineLabel("scheduled", false),
          value: formatHangMoney(lot.startingPrice, currency),
        },
    notes: [`Opens ${formatLondonMoment(lot.startTime, ctx.now)}`],
    live: undefined,
  };
}

/**
 * The wall label for a lot: lot number, title, the figure that matters in its state (current bid,
 * opening bid or estimate, sold price with the buyer's premium) and when it closes or opens.
 */
export function hangLabelModel(lot: Lot, ctx: HangLabelContext): HangLabelModel {
  const currency = lotChargeCurrency(lot);
  const state =
    lot.status === "ended" ? endedLabel(lot, ctx, currency) : biddingLabel(lot, ctx, currency);
  return {
    eyebrow: lotEyebrow(lot),
    title: lot.title,
    ...state,
    notes: ctx.shownFramed ? [...state.notes, "Shown framed"] : state.notes,
  };
}
