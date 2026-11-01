import { formatLotMoment } from "@/lib/bid/lot-moment";
import { type MyBidStatus, latestBidPerLot, myBidStatus } from "@/lib/bid/my-bid-status";
import type { BidWithLot, WatchlistWithLotRow } from "@/lib/data/dto/dashboard-dtos";
import { formatEstimateRange, formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { matchesEveryWord, searchParam } from "@/lib/workspace/list-search";
import type { Lot, LotStatus } from "@auction/types";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";
import type { WatchedLotReminderVm } from "./watched-lot-reminder.vm";

/** The views of Watching, in order. The ids are the page's `?tab=` values. */
export const WATCHING_VIEWS = ["lots", "artists", "searches"] as const;
export type WatchingView = (typeof WATCHING_VIEWS)[number];

export const WATCHING_VIEW_LABEL: Record<WatchingView, string> = {
  lots: "Lots",
  artists: "Artists",
  searches: "Searches",
};

export function parseWatchingView(raw: string | string[] | null | undefined): WatchingView {
  const value = searchParam(raw);
  return (WATCHING_VIEWS as readonly string[]).includes(value ?? "")
    ? (value as WatchingView)
    : "lots";
}

/** Where a watched lot stands for the person: their bid first, then the lot's own moment. */
export type WatchedLotStanding =
  | "winning"
  | "outbid"
  | "maximum-set"
  | "not-bidding"
  | "sold"
  | "closed";

const STANDING: Record<
  WatchedLotStanding,
  { label: string; tone: StatusBadgeTone; shape: StatusBadgeShape }
> = {
  winning: { label: "Winning", tone: "success", shape: "check" },
  outbid: { label: "Outbid", tone: "warning", shape: "alert" },
  "maximum-set": { label: "Maximum set", tone: "info", shape: "dot" },
  "not-bidding": { label: "Not bidding", tone: "neutral", shape: "ring" },
  sold: { label: "Sold", tone: "neutral", shape: "ring" },
  closed: { label: "Closed", tone: "neutral", shape: "ring" },
};

const BID_STANDING: Partial<Record<MyBidStatus, WatchedLotStanding>> = {
  winning: "winning",
  outbid: "outbid",
  "maximum-set": "maximum-set",
  absentee: "maximum-set",
};

const ENDED: ReadonlySet<LotStatus> = new Set(["ended", "cancelled", "voided"]);

export type WatchedLotRowVm = {
  lotId: string;
  href: string;
  title: string;
  image: string | null;
  lotLabel: string | null;
  saleTitle: string | null;
  /** "closes Today 18:00", "opens 26 Nov", "closed 2 Nov". */
  moment: string;
  standing: { label: string; tone: StatusBadgeTone; shape: StatusBadgeShape };
  figure: { value: string; label: string };
  ended: boolean;
  /** For sorting: when it closes, and when it was watched. */
  closesAt: number;
  watchedAt: number;
  /** When the lot opens, for the reminder times. */
  startsAt: number;
  /** The person's reminder and note on it, when they set one. */
  reminder: WatchedLotReminderVm | null;
};

function standingOf(lot: Lot, bid: MyBidStatus | null): WatchedLotStanding {
  if (ENDED.has(lot.status)) return lot.hasWinner || lot.winnerId ? "sold" : "closed";
  return (bid ? BID_STANDING[bid] : undefined) ?? "not-bidding";
}

function figureFor(lot: Lot, standing: WatchedLotStanding): { value: string; label: string } {
  const money = (amount: string) => formatMoney(amount, lotChargeCurrency(lot));
  if (standing === "sold") return { value: money(lot.currentPrice), label: "sold for" };
  if (standing === "closed") return { value: "–", label: "not sold" };
  const opened = lot.status === "active";
  if (opened) return { value: money(lot.currentPrice), label: "current bid" };
  const estimate = lot.marketingDetails?.estimate;
  return estimate
    ? { value: formatEstimateRange(estimate), label: "estimate" }
    : { value: money(lot.startingPrice), label: "opening bid" };
}

function momentFor(lot: Lot, now: Date): string {
  if (ENDED.has(lot.status)) return `closed ${formatLotMoment(lot.endTime, now, { time: false })}`;
  if (lot.status === "active") return `closes ${formatLotMoment(lot.endTime, now)}`;
  return `opens ${formatLotMoment(lot.startTime, now, { time: false })}`;
}

/** The watched lots, with where the person stands on each. */
export function buildWatchedLots(input: {
  rows: readonly WatchlistWithLotRow[];
  bids: readonly BidWithLot[];
  userId: string | undefined;
  saleTitleById?: Readonly<Record<string, string>>;
  now?: Date;
}): WatchedLotRowVm[] {
  const now = input.now ?? new Date();
  const bidByLot = new Map(latestBidPerLot(input.bids).map((row) => [row.bid.lotId, row]));
  return input.rows.flatMap((row) => {
    const lot = row.lot;
    if (!lot) return [];
    const myBid = bidByLot.get(lot.id) ?? null;
    const standing = standingOf(lot, myBid ? myBidStatus(myBid, input.userId) : null);
    return [
      {
        lotId: lot.id,
        href: lotPath(lot),
        title: lot.title,
        image: lot.images[0] ?? null,
        lotLabel: lot.lotNumber == null ? null : `Lot ${lot.lotNumber}`,
        saleTitle: lot.saleId ? (input.saleTitleById?.[lot.saleId] ?? null) : null,
        moment: momentFor(lot, now),
        standing: STANDING[standing],
        figure: figureFor(lot, standing),
        ended: ENDED.has(lot.status),
        closesAt: lot.endTime.getTime(),
        watchedAt: row.createdAt.getTime(),
        startsAt: lot.startTime.getTime(),
        reminder: null,
      },
    ];
  });
}

export const WATCHED_LOT_SORTS = ["closing", "added"] as const;
export type WatchedLotSort = (typeof WATCHED_LOT_SORTS)[number];

export const WATCHED_LOT_SORT_LABEL: Record<WatchedLotSort, string> = {
  closing: "Closing soonest",
  added: "Recently watched",
};

/**
 * The watched lots after search and sort. Closing soonest puts open lots first, soonest to close,
 * and ended lots last, most recent first.
 */
export function watchedLotsInView(
  rows: readonly WatchedLotRowVm[],
  query: string,
  sort: WatchedLotSort,
): WatchedLotRowVm[] {
  const matches = rows.filter((row) =>
    matchesEveryWord([row.title, row.lotLabel, row.saleTitle], query),
  );
  if (sort === "added") return matches.sort((a, b) => b.watchedAt - a.watchedAt);
  return matches.sort((a, b) =>
    a.ended === b.ended
      ? a.ended
        ? b.closesAt - a.closesAt
        : a.closesAt - b.closesAt
      : a.ended
        ? 1
        : -1,
  );
}

type ReminderRead = {
  lotId: string;
  kind: WatchedLotReminderVm["kind"];
  note: string | null;
  sentAt: string | null;
};

/** Puts each lot's reminder on its row; a reminder already sent no longer shows. */
export function withReminders(
  rows: readonly WatchedLotRowVm[],
  reminders: readonly ReminderRead[],
): WatchedLotRowVm[] {
  const pending = reminders.filter((r) => r.sentAt === null);
  const byLot = new Map(pending.map((r) => [r.lotId, { kind: r.kind, note: r.note }]));
  return rows.map((row) => ({ ...row, reminder: byLot.get(row.lotId) ?? null }));
}
