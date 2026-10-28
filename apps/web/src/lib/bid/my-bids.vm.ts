import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { formatEstimateRange, formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { formatDateTimeShort } from "@/lib/ui/format";
import type { Lot } from "@auction/types";
import { formatBidPlacementBadgeLabel, getBidPlacement } from "./bid-placement-presenter";
import { type MyBidAction, myBidActions } from "./my-bid-next-action";
import {
  MY_BID_TABS,
  MY_BID_TAB_LABEL,
  type MyBidStatus,
  type MyBidTab,
  groupMyBids,
} from "./my-bid-status";

/** One figure on a bid card: a value, or the live time left before the lot closes. */
export type MyBidFigure =
  | { label: string; kind: "text"; value: string }
  | { label: string; kind: "countdown"; endsAt: string };

export type MyBidCardVm = {
  id: string;
  lotId: string;
  /** The lot page; `null` for a lot that has been withdrawn from the catalogue. */
  href: string | null;
  image: string | null;
  title: string;
  /** "Lot 14", or `null` before the lot has a number. */
  lotLabel: string | null;
  saleTitle: string | null;
  /** Medium and size, the way the catalogue names the work. */
  details: string | null;
  /** Set when staff placed the bid for the person, on the telephone or in the room. */
  placementNote: string | null;
  status: MyBidStatus;
  statusLabel: string;
  figures: MyBidFigure[];
  actions: MyBidAction[];
};

export type MyBidsVm = {
  tab: MyBidTab;
  tabs: { id: MyBidTab; label: string; count: number }[];
  cards: MyBidCardVm[];
  /** Open lots on the page, for live price updates. */
  liveLots: { lotId: string; lotLabel: string | null; title: string }[];
};

export const MY_BID_STATUS_LABEL: Record<MyBidStatus, string> = {
  winning: "Winning",
  outbid: "Outbid",
  absentee: "Absentee bid placed",
  won: "Won",
  "not-won": "Not won",
  withdrawn: "Withdrawn",
};

function money(amount: string | number, lot: Lot): string {
  return formatMoney(amount, resolveLotCurrency(lot));
}

function yourMaximum(row: BidWithLot, lot: Lot): string {
  return money(row.bid.maxAutoBidAmount ?? row.bid.amount, lot);
}

function estimateOrOpening(lot: Lot): MyBidFigure {
  const estimate = lot.marketingDetails?.estimate;
  return estimate
    ? { label: "Estimate", kind: "text", value: formatEstimateRange(estimate) }
    : { label: "Opening bid", kind: "text", value: money(lot.startingPrice, lot) };
}

function closedOn(lot: Lot, now: Date): MyBidFigure {
  return { label: "Closed", kind: "text", value: formatDateTimeShort(lot.endTime, now) };
}

/** The three figures a card shows, chosen by where the bid stands. */
function figuresFor(status: MyBidStatus, row: BidWithLot, lot: Lot, now: Date): MyBidFigure[] {
  switch (status) {
    case "winning":
    case "outbid":
      return [
        { label: "Current bid", kind: "text", value: money(lot.currentPrice, lot) },
        { label: "Your maximum", kind: "text", value: yourMaximum(row, lot) },
        { label: "Closes in", kind: "countdown", endsAt: lot.endTime.toISOString() },
      ];
    case "absentee":
      return [
        estimateOrOpening(lot),
        { label: "Absentee bid", kind: "text", value: yourMaximum(row, lot) },
        { label: "Sale starts", kind: "text", value: formatDateTimeShort(lot.startTime, now) },
      ];
    case "won":
      return [
        {
          label: "Hammer price",
          kind: "text",
          value: money(lot.checkoutPricing?.hammerMajor ?? lot.currentPrice, lot),
        },
        { label: "Your maximum", kind: "text", value: yourMaximum(row, lot) },
        closedOn(lot, now),
      ];
    default:
      return [
        { label: "Final bid", kind: "text", value: money(lot.currentPrice, lot) },
        { label: "Your maximum", kind: "text", value: yourMaximum(row, lot) },
        closedOn(lot, now),
      ];
  }
}

function lotDetails(lot: Lot): string | null {
  const parts = [lot.medium, lot.dimensions].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function toCard(
  { row, status }: { row: BidWithLot; status: MyBidStatus },
  saleTitleById: Readonly<Record<string, string>>,
  now: Date,
): MyBidCardVm {
  const { bid, lot } = row;
  const base = {
    id: bid.id,
    lotId: bid.lotId,
    status,
    statusLabel: MY_BID_STATUS_LABEL[status],
    actions: myBidActions(status, lot),
    placementNote: formatBidPlacementBadgeLabel(getBidPlacement(bid)) || null,
  };
  if (!lot) {
    return {
      ...base,
      href: null,
      image: null,
      title: "Lot withdrawn from the sale",
      lotLabel: null,
      saleTitle: null,
      details: null,
      figures: [],
    };
  }
  return {
    ...base,
    href: lotPath(lot),
    image: lot.images[0] ?? null,
    title: lot.title,
    lotLabel: lot.lotNumber == null ? null : `Lot ${lot.lotNumber}`,
    saleTitle: lot.saleId ? (saleTitleById[lot.saleId] ?? null) : null,
    details: lotDetails(lot),
    figures: figuresFor(status, row, lot, now),
  };
}

/** My bids for one view: its cards, the count in every view and the lots to follow live. */
export function buildMyBidsVm(input: {
  rows: readonly BidWithLot[];
  userId: string | undefined;
  tab: MyBidTab;
  saleTitleById?: Readonly<Record<string, string>>;
  now?: Date;
}): MyBidsVm {
  const now = input.now ?? new Date();
  const groups = groupMyBids(input.rows, input.userId);
  const cards = groups[input.tab].map((entry) => toCard(entry, input.saleTitleById ?? {}, now));
  return {
    tab: input.tab,
    tabs: MY_BID_TABS.map((id) => ({ id, label: MY_BID_TAB_LABEL[id], count: groups[id].length })),
    cards,
    liveLots: groups.active.flatMap(({ row, status }) =>
      row.lot && (status === "winning" || status === "outbid")
        ? [
            {
              lotId: row.lot.id,
              lotLabel: row.lot.lotNumber == null ? null : String(row.lot.lotNumber),
              title: row.lot.title,
            },
          ]
        : [],
    ),
  };
}
