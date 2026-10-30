import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import { formatBidPlacementBadgeLabel, getBidPlacement } from "./bid-placement-presenter";
import { formatLotMoment } from "./lot-moment";
import { type MyBidAction, myBidActions } from "./my-bid-next-action";
import { MY_BID_TABS, type MyBidStatus, type MyBidTab, groupMyBids } from "./my-bid-status";

/** One figure on a bid row: the value above what it is ("£6,800" over "current bid"). */
export type MyBidFigure = { label: string; value: string };

export type MyBidCardVm = {
  id: string;
  lotId: string;
  /** The lot page; `null` for a lot that has been withdrawn from the catalogue. */
  href: string | null;
  image: string | null;
  title: string;
  /** "Lot 14", or `null` before the lot has a number. */
  lotLabel: string | null;
  saleId: string | null;
  saleTitle: string | null;
  /** Who placed the bid, on an organisation's shared list; `null` where it goes without saying. */
  placedBy: string | null;
  /** Set when staff placed the bid, on the telephone or in the room. */
  placementNote: string | null;
  status: MyBidStatus;
  statusLabel: string;
  figures: MyBidFigure[];
  /** The one step shown on the row; anything else sits in the row's menu. */
  next: MyBidAction | null;
  more: MyBidAction[];
  /** For sorting: when the lot closes (or closed), and the bid's amount. */
  closesAt: number;
  amount: number;
};

/** A sale the bids were placed in, for the sale filter. */
export type MyBidSale = { id: string; title: string };

export type MyBidsVm = {
  cardsByTab: Record<MyBidTab, MyBidCardVm[]>;
  /** The sales the bids are in, A to Z, for the filter. */
  sales: MyBidSale[];
  /** The members who placed the bids, A to Z, when the list is shared. */
  placers: string[];
  /** Open lots, for live price updates. */
  liveLots: { lotId: string; lotLabel: string | null; title: string }[];
};

export const MY_BID_STATUS_LABEL: Record<MyBidStatus, string> = {
  winning: "Winning",
  outbid: "Outbid",
  "maximum-set": "Maximum set",
  absentee: "Absentee bid",
  won: "Won",
  "not-won": "Not won",
  withdrawn: "Withdrawn",
};

/** The figure that stands in for an amount there is not yet: the lot has no bids. */
const NO_AMOUNT = "–";

function money(amount: string | number, lot: Lot): string {
  return formatMoney(amount, lotChargeCurrency(lot));
}

function yourMaximum(row: BidWithLot, lot: Lot): string {
  return money(row.bid.maxAutoBidAmount ?? row.bid.amount, lot);
}

/** Before the lot opens, the current bid is the price only once someone has bid. */
function currentBidBeforeOpening(lot: Lot): string {
  return Number.parseFloat(lot.currentPrice) > Number.parseFloat(lot.startingPrice)
    ? money(lot.currentPrice, lot)
    : NO_AMOUNT;
}

/** The three figures a row shows, chosen by where the bid stands. */
function figuresFor(status: MyBidStatus, row: BidWithLot, lot: Lot, now: Date): MyBidFigure[] {
  switch (status) {
    case "winning":
    case "outbid":
      return [
        { label: "current bid", value: money(lot.currentPrice, lot) },
        { label: "your maximum", value: yourMaximum(row, lot) },
        { label: "closes", value: formatLotMoment(lot.endTime, now) },
      ];
    case "maximum-set":
    case "absentee":
      return [
        { label: "current bid", value: currentBidBeforeOpening(lot) },
        {
          label: status === "absentee" ? "absentee bid" : "your maximum",
          value: yourMaximum(row, lot),
        },
        { label: "sale day", value: formatLotMoment(lot.startTime, now, { time: false }) },
      ];
    case "won":
      return [
        {
          label: "hammer price",
          value: money(lot.checkoutPricing?.hammerMajor ?? lot.currentPrice, lot),
        },
        { label: "your maximum", value: yourMaximum(row, lot) },
        { label: "closed", value: formatLotMoment(lot.endTime, now, { time: false }) },
      ];
    default:
      return [
        { label: "final bid", value: money(lot.currentPrice, lot) },
        { label: "your maximum", value: yourMaximum(row, lot) },
        { label: "closed", value: formatLotMoment(lot.endTime, now, { time: false }) },
      ];
  }
}

function toCard(
  { row, status }: { row: BidWithLot; status: MyBidStatus },
  context: { saleTitleById: Readonly<Record<string, string>>; showPlacedBy: boolean; now: Date },
): MyBidCardVm {
  const { bid, lot } = row;
  const actions = myBidActions(status, lot);
  const base = {
    id: bid.id,
    lotId: bid.lotId,
    status,
    statusLabel: MY_BID_STATUS_LABEL[status],
    next: actions.at(-1) ?? null,
    more: actions.slice(0, -1),
    placementNote: formatBidPlacementBadgeLabel(getBidPlacement(bid)) || null,
    placedBy: context.showPlacedBy ? (row.placedBy?.name ?? null) : null,
    amount: Number.parseFloat(bid.maxAutoBidAmount ?? bid.amount),
  };
  if (!lot) {
    return {
      ...base,
      href: null,
      image: null,
      title: "Lot withdrawn from the sale",
      lotLabel: null,
      saleId: null,
      saleTitle: null,
      figures: [],
      closesAt: bid.createdAt.getTime(),
    };
  }
  return {
    ...base,
    href: lotPath(lot),
    image: lot.images[0] ?? null,
    title: lot.title,
    lotLabel: lot.lotNumber == null ? null : `Lot ${lot.lotNumber}`,
    saleId: lot.saleId ?? null,
    saleTitle: lot.saleId ? (context.saleTitleById[lot.saleId] ?? null) : null,
    figures: figuresFor(status, row, lot, context.now),
    closesAt: lot.endTime.getTime(),
  };
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * Every view of Bids at once, so the page can search, filter and switch views without a round
 * trip. `showPlacedBy` names the member on each row of a list shared by several bidders.
 */
export function buildMyBidsVm(input: {
  rows: readonly BidWithLot[];
  userId: string | undefined;
  showPlacedBy?: boolean;
  saleTitleById?: Readonly<Record<string, string>>;
  now?: Date;
}): MyBidsVm {
  const context = {
    saleTitleById: input.saleTitleById ?? {},
    showPlacedBy: input.showPlacedBy ?? false,
    now: input.now ?? new Date(),
  };
  const groups = groupMyBids(input.rows, input.userId);
  const cardsByTab = Object.fromEntries(
    MY_BID_TABS.map((tab) => [tab, groups[tab].map((entry) => toCard(entry, context))]),
  ) as Record<MyBidTab, MyBidCardVm[]>;
  const all = MY_BID_TABS.flatMap((tab) => cardsByTab[tab]);
  const saleTitles = new Map<string, string>();
  for (const card of all) {
    if (card.saleId && card.saleTitle) saleTitles.set(card.saleId, card.saleTitle);
  }
  return {
    cardsByTab,
    sales: [...saleTitles]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    placers: uniqueSorted(all.flatMap((card) => (card.placedBy ? [card.placedBy] : []))),
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
