/**
 * "LAX listing": where an original is today, as staff read it on the Zoho Product. It is the
 * "Where it is" place (see `where-it-is.ts`) with two refinements Zoho users need at a glance:
 * a LAX Bid sale says whether it is upcoming, live now or ended, and a sale says where it was made.
 * The labels are the values of the Zoho picklist `LAX_Listing`, so they must match it exactly.
 */

import type { SoldWhere } from "./sold-in-gallery.js";
import { WHERE_IT_IS_CHIPS, type WhereItIs } from "./where-it-is.js";

/** Where a LAX Bid sale stands for one of its lots. */
export const BID_SALE_PHASES = ["upcoming", "live_now", "ended"] as const;
export type BidSalePhase = (typeof BID_SALE_PHASES)[number];

export type BidLotStatus = "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
export type BidSaleStatus = "draft" | "scheduled" | "active" | "ended" | "cancelled";

/**
 * The phase from the lot and its sale. A lot that has closed is ended even while the rest of its
 * sale runs; otherwise the sale decides, so every lot of a sale that has started reads live now,
 * including those still waiting for the block. A sale also counts as started once its own start
 * time has passed, even if no lot is active yet and its status has not caught up. A lot outside a
 * sale has not started. The start time (null when the lot is in no sale) and `now` are always
 * given, so the answer never depends on a hidden clock.
 */
export function deriveBidSalePhase(input: {
  lotStatus: BidLotStatus;
  saleStatus: BidSaleStatus | null;
  saleStartTime: Date | null;
  now: Date;
}): BidSalePhase {
  const { lotStatus, saleStatus, saleStartTime, now } = input;
  if (lotStatus === "ended" || lotStatus === "cancelled" || lotStatus === "voided") return "ended";
  if (saleStatus === "ended" || saleStatus === "cancelled") return "ended";
  if (lotStatus === "active" || saleStatus === "active") return "live_now";
  const startedByTime =
    saleStatus === "scheduled" && saleStartTime !== null && saleStartTime <= now;
  if (startedByTime) return "live_now";
  return "upcoming";
}

export const LAX_LISTING_KEYS = [
  "not_offered",
  "draft_lax_art",
  "lax_art",
  "draft_bid_lot",
  "bid_sale_upcoming",
  "bid_sale_live_now",
  "bid_sale_ended",
  "private_sale",
  "sold_lax_art",
  "sold_bid_sale",
  "sold_private_sale",
  "sold_gallery",
  "sold",
  "withdrawn",
] as const;
export type LaxListingKey = (typeof LAX_LISTING_KEYS)[number];

const BID_PHASE_SUFFIX: Record<BidSalePhase, string> = {
  upcoming: "upcoming",
  live_now: "live now",
  ended: "ended",
};

function bidSaleLabel(phase: BidSalePhase): string {
  return `${WHERE_IT_IS_CHIPS.bid_sale.label} — ${BID_PHASE_SUFFIX[phase]}`;
}

/**
 * The picklist value for each key. Places that read the same in LAX Admin take the chip's label,
 * so the two can never drift apart; the rest add the phase or where the sale was made.
 */
export const LAX_LISTING_LABEL: Readonly<Record<LaxListingKey, string>> = {
  not_offered: WHERE_IT_IS_CHIPS.not_offered.label,
  draft_lax_art: WHERE_IT_IS_CHIPS.draft_lax_art.label,
  lax_art: WHERE_IT_IS_CHIPS.lax_art.label,
  draft_bid_lot: WHERE_IT_IS_CHIPS.draft_bid_lot.label,
  bid_sale_upcoming: bidSaleLabel("upcoming"),
  bid_sale_live_now: bidSaleLabel("live_now"),
  bid_sale_ended: bidSaleLabel("ended"),
  private_sale: WHERE_IT_IS_CHIPS.private_sale.label,
  sold_lax_art: "Sold on lax.art",
  sold_bid_sale: "Sold in LAX Bid",
  sold_private_sale: "Sold privately",
  sold_gallery: "Sold in the gallery",
  sold: WHERE_IT_IS_CHIPS.sold.label,
  withdrawn: WHERE_IT_IS_CHIPS.withdrawn.label,
};

const SOLD_KEY: Record<SoldWhere, LaxListingKey> = {
  lax_art: "sold_lax_art",
  bid_sale: "sold_bid_sale",
  private_sale: "sold_private_sale",
  gallery: "sold_gallery",
  unknown: "sold",
};

const BID_SALE_KEY: Record<BidSalePhase, LaxListingKey> = {
  upcoming: "bid_sale_upcoming",
  live_now: "bid_sale_live_now",
  ended: "bid_sale_ended",
};

/**
 * The listing for a place. A Bid sale needs its phase; without one (the lot cannot be read) it
 * reads upcoming, the state it is in until the sale opens, and the next change corrects it.
 */
export function laxListingKeyFor(where: WhereItIs, bidPhase: BidSalePhase | null): LaxListingKey {
  switch (where.key) {
    case "bid_sale":
      return BID_SALE_KEY[bidPhase ?? "upcoming"];
    case "sold":
      return SOLD_KEY[where.soldWhere];
    default:
      return where.key;
  }
}
