/** How a bid reached the lot, in the words the public history uses. */
export type PublicBidChannel = "online" | "room" | "phone";

const CHANNEL_BY_PLACED_VIA: Readonly<Record<string, PublicBidChannel>> = {
  web: "online",
  // A commission bid is left in advance and executed online when the lot opens.
  absentee: "online",
  saleroom: "room",
  telephone: "phone",
};

/** The public channel for a stored `placed_via`; an unrecorded one was placed online. */
export function publicBidChannel(placedVia: string | null | undefined): PublicBidChannel {
  return (placedVia ? CHANNEL_BY_PLACED_VIA[placedVia] : undefined) ?? "online";
}

/** One row of the public history: no bidder, no paddle, no account. */
export type PublicBidHistoryEntry = {
  amount: string;
  channel: PublicBidChannel;
  placedAt: string;
  /** The row is the viewer's own bid, so the page can say "You". */
  isViewer: boolean;
};

export type PublicBidHistory = {
  entries: PublicBidHistoryEntry[];
  /** Every bid on the lot, not only those listed. */
  total: number;
};

type BidRowForHistory = {
  amount: string;
  placedVia?: string | null;
  createdAt: Date | string;
  /** Whether the viewer's account placed this bid. */
  placedByViewer: boolean;
};

/** Anonymises bids for the public: only what a bidder in the room could see or hear. */
export function toPublicBidHistory(
  rows: readonly BidRowForHistory[],
  total: number,
): PublicBidHistory {
  return {
    entries: rows.map((row) => ({
      amount: row.amount,
      channel: publicBidChannel(row.placedVia),
      placedAt: new Date(row.createdAt).toISOString(),
      isViewer: row.placedByViewer,
    })),
    total: Math.max(total, rows.length),
  };
}
