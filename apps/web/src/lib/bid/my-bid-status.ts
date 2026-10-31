import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";

/**
 * Where one of the person's bids stands. The My bids page, the header prompt and the account
 * sub-navigation all read it from here, so they never disagree.
 */
export type MyBidStatus =
  | "winning"
  | "outbid"
  | "maximum-set"
  | "absentee"
  | "won"
  | "not-won"
  | "withdrawn";

/** The views of My bids, in order. The ids stay the page's `?tab=` values. */
export const MY_BID_TABS = ["active", "won", "lost"] as const;
export type MyBidTab = (typeof MY_BID_TABS)[number];

export const MY_BID_TAB_LABEL: Record<MyBidTab, string> = {
  active: "Active",
  won: "Won",
  lost: "Not won",
};

const STATUS_TAB: Record<MyBidStatus, MyBidTab> = {
  winning: "active",
  outbid: "active",
  "maximum-set": "active",
  absentee: "active",
  won: "won",
  "not-won": "lost",
  withdrawn: "lost",
};

/** Most pressing first within the Active view: outbid, then winning, then waiting to open. */
const ACTIVE_ORDER: Record<MyBidStatus, number> = {
  outbid: 0,
  winning: 1,
  "maximum-set": 2,
  absentee: 2,
  won: 3,
  "not-won": 3,
  withdrawn: 3,
};

export function parseMyBidTab(raw: string | null | undefined): MyBidTab {
  return (MY_BID_TABS as readonly string[]).includes(raw ?? "") ? (raw as MyBidTab) : "active";
}

export function myBidTab(status: MyBidStatus): MyBidTab {
  return STATUS_TAB[status];
}

/** Prices are compared to the penny; a bid within a penny of the current price is the leading one. */
function sameAmount(a: string, b: string): boolean {
  return Math.abs(Number.parseFloat(a) - Number.parseFloat(b)) < 0.005;
}

/**
 * The status of the person's latest bid on a lot. A lot won by the person, or by the account they
 * bid for, is "won"; a lot still open is "winning" while their bid is the current price.
 */
export function myBidStatus(row: BidWithLot, userId: string | undefined): MyBidStatus {
  const { bid, lot } = row;
  if (!lot) return "withdrawn";
  switch (lot.status) {
    case "active":
      return bid.isWinning && sameAmount(bid.amount, lot.currentPrice) ? "winning" : "outbid";
    case "draft":
    case "scheduled":
      // Before the lot opens: a bid left with the saleroom is an absentee bid; one placed online
      // waits as the maximum the account will go to.
      return bid.placedVia === "absentee" ? "absentee" : "maximum-set";
    case "ended": {
      const wonByPerson = Boolean(userId && lot.winnerId === userId);
      const wonByAccount = Boolean(
        lot.buyerLegalEntityId &&
          bid.buyerLegalEntityId &&
          lot.buyerLegalEntityId === bid.buyerLegalEntityId,
      );
      return wonByPerson || wonByAccount ? "won" : "not-won";
    }
    default:
      return "withdrawn";
  }
}

/** The latest bid per lot: earlier bids on the same lot are history, not separate entries. */
export function latestBidPerLot(rows: readonly BidWithLot[]): BidWithLot[] {
  const latest = new Map<string, BidWithLot>();
  for (const row of rows) {
    const prev = latest.get(row.bid.lotId);
    if (!prev || row.bid.createdAt > prev.bid.createdAt) latest.set(row.bid.lotId, row);
  }
  return [...latest.values()];
}

export type ClassifiedBid = { row: BidWithLot; status: MyBidStatus };

function closeTime(row: BidWithLot): number {
  return row.lot?.endTime.getTime() ?? 0;
}

/**
 * The person's bids sorted into the three views. Active lots come most pressing first, then
 * soonest to close; won and not-won lots come most recent first.
 */
export function groupMyBids(
  rows: readonly BidWithLot[],
  userId: string | undefined,
): Record<MyBidTab, ClassifiedBid[]> {
  const groups: Record<MyBidTab, ClassifiedBid[]> = { active: [], won: [], lost: [] };
  for (const row of latestBidPerLot(rows)) {
    const status = myBidStatus(row, userId);
    groups[myBidTab(status)].push({ row, status });
  }
  groups.active.sort(
    (a, b) =>
      ACTIVE_ORDER[a.status] - ACTIVE_ORDER[b.status] || closeTime(a.row) - closeTime(b.row),
  );
  groups.won.sort((a, b) => closeTime(b.row) - closeTime(a.row));
  groups.lost.sort((a, b) => closeTime(b.row) - closeTime(a.row));
  return groups;
}
