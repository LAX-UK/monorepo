import { type MyBidStatus, latestBidPerLot, myBidStatus } from "@/lib/bid/my-bid-status";
import type { BidWithLot, WatchlistWithLotRow } from "@/lib/data/dto/dashboard-dtos";
import { formatEstimateRange, formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import type { Lot, LotStatus } from "@auction/types";

/** The views of Watching, in order. The ids are the page's `?tab=` values. */
export const WATCHING_TABS = ["upcoming", "live", "ended"] as const;
export type WatchingTab = (typeof WATCHING_TABS)[number];

export const WATCHING_TAB_LABEL: Record<WatchingTab, string> = {
  upcoming: "Upcoming",
  live: "Live",
  ended: "Ended",
};

const STATUS_TAB: Record<LotStatus, WatchingTab> = {
  draft: "upcoming",
  scheduled: "upcoming",
  active: "live",
  ended: "ended",
  cancelled: "ended",
  voided: "ended",
};

/** The pill on a watched lot: the person's own bid first, then the lot's own moment. */
export type WatchedLotBadge =
  | "winning"
  | "outbid"
  | "absentee"
  | "closing-soon"
  | "live"
  | "upcoming"
  | "sold"
  | "closed";

export const WATCHED_BADGE_LABEL: Record<WatchedLotBadge, string> = {
  winning: "You're winning",
  outbid: "Outbid",
  absentee: "Absentee bid",
  "closing-soon": "Closing soon",
  live: "Live",
  upcoming: "Upcoming",
  sold: "Sold",
  closed: "Closed",
};

/** A bid outranks the lot's own state: the person cares most about where they stand. */
const BID_BADGE: Partial<Record<MyBidStatus, WatchedLotBadge>> = {
  winning: "winning",
  outbid: "outbid",
  absentee: "absentee",
};

/** The last hour before a lot closes. */
const CLOSING_SOON_MS = 60 * 60 * 1000;

export type WatchedLotCardVm = {
  lotId: string;
  href: string;
  title: string;
  image: string | null;
  lotLabel: string | null;
  estimate: string | null;
  badge: WatchedLotBadge;
  badgeLabel: string;
  /** Bottom line, left: the figure that matters now ("£2,600", "Absentee £18,000"). */
  figure: string;
  /** Bottom line, right: time left, the opening date or the closing date. */
  timing: { kind: "countdown"; endsAt: string } | { kind: "date"; label: string };
};

export type WatchingVm = {
  tab: WatchingTab;
  tabs: { id: WatchingTab; label: string; count: number }[];
  cards: WatchedLotCardVm[];
  /** "4 lots in 2 sales": what the view holds. */
  summary: string;
  total: number;
};

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function lotBadge(lot: Lot, bid: MyBidStatus | null, now: Date): WatchedLotBadge {
  const fromBid = bid ? BID_BADGE[bid] : undefined;
  if (fromBid) return fromBid;
  switch (STATUS_TAB[lot.status]) {
    case "live":
      return lot.endTime.getTime() - now.getTime() <= CLOSING_SOON_MS ? "closing-soon" : "live";
    case "upcoming":
      return "upcoming";
    default:
      return lot.hasWinner || lot.winnerId ? "sold" : "closed";
  }
}

function figureFor(lot: Lot, badge: WatchedLotBadge, myBid: BidWithLot | null): string {
  const money = (amount: string) => formatMoney(amount, lotChargeCurrency(lot));
  if (badge === "absentee" && myBid) {
    return `Absentee ${money(myBid.bid.maxAutoBidAmount ?? myBid.bid.amount)}`;
  }
  switch (STATUS_TAB[lot.status]) {
    case "upcoming":
      return `Opens at ${money(lot.startingPrice)}`;
    case "live":
      return money(lot.currentPrice);
    default:
      return badge === "sold" ? `Sold for ${money(lot.currentPrice)}` : "Not sold";
  }
}

function timingFor(lot: Lot): WatchedLotCardVm["timing"] {
  switch (STATUS_TAB[lot.status]) {
    case "live":
      return { kind: "countdown", endsAt: lot.endTime.toISOString() };
    case "upcoming":
      return { kind: "date", label: DAY_MONTH.format(lot.startTime) };
    default:
      return { kind: "date", label: `Closed ${DAY_MONTH.format(lot.endTime)}` };
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The view to open when none is asked for: Live while anything is live, else Upcoming, else Ended. */
function defaultTab(counts: Record<WatchingTab, number>): WatchingTab {
  if (counts.live > 0) return "live";
  if (counts.upcoming > 0) return "upcoming";
  return counts.ended > 0 ? "ended" : "upcoming";
}

export function parseWatchingTab(raw: string | null | undefined): WatchingTab | null {
  return (WATCHING_TABS as readonly string[]).includes(raw ?? "") ? (raw as WatchingTab) : null;
}

/**
 * Watching for one view: a card per followed lot with where the person stands on it. Lots keep
 * the order the list was read in (the chosen sort).
 */
export function buildWatchingVm(input: {
  rows: readonly WatchlistWithLotRow[];
  bids: readonly BidWithLot[];
  userId: string | undefined;
  tab: WatchingTab | null;
  now?: Date;
}): WatchingVm {
  const now = input.now ?? new Date();
  const bidByLot = new Map(latestBidPerLot(input.bids).map((row) => [row.bid.lotId, row]));
  const lots = input.rows.flatMap((row) => (row.lot ? [row.lot] : []));
  const counts = Object.fromEntries(
    WATCHING_TABS.map((tab) => [tab, lots.filter((lot) => STATUS_TAB[lot.status] === tab).length]),
  ) as Record<WatchingTab, number>;
  const tab = input.tab ?? defaultTab(counts);
  const inView = lots.filter((lot) => STATUS_TAB[lot.status] === tab);
  const sales = new Set(inView.map((lot) => lot.saleId ?? lot.id));

  return {
    tab,
    tabs: WATCHING_TABS.map((id) => ({ id, label: WATCHING_TAB_LABEL[id], count: counts[id] })),
    total: lots.length,
    summary:
      inView.length === 0
        ? ""
        : `${plural(inView.length, "lot", "lots")} in ${plural(sales.size, "sale", "sales")}`,
    cards: inView.map((lot) => {
      const myBid = bidByLot.get(lot.id) ?? null;
      const badge = lotBadge(lot, myBid ? myBidStatus(myBid, input.userId) : null, now);
      const estimate = lot.marketingDetails?.estimate;
      return {
        lotId: lot.id,
        href: lotPath(lot),
        title: lot.title,
        image: lot.images[0] ?? null,
        lotLabel: lot.lotNumber == null ? null : `Lot ${lot.lotNumber}`,
        estimate: estimate ? `Estimate ${formatEstimateRange(estimate)}` : null,
        badge,
        badgeLabel: WATCHED_BADGE_LABEL[badge],
        figure: figureFor(lot, badge, myBid),
        timing: timingFor(lot),
      };
    }),
  };
}
