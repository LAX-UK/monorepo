/**
 * What a lot says about itself in each moment of its life. One table drives the badge, the
 * headline label, the time line and the primary action, so an ended lot can never say
 * "Current bid" and a withdrawn one can never offer a bid.
 */

export const LOT_LIFECYCLE_KINDS = [
  "preLaunch",
  "scheduled",
  "live",
  "extended",
  "liveSaleroom",
  "saleroomPaused",
  "endedSold",
  "endedNoSale",
  "cancelled",
  "withdrawn",
] as const;

export type LotLifecycleKind = (typeof LOT_LIFECYCLE_KINDS)[number];

/** The workspace status tones. Tone is never the only signal: every state also has words. */
export type LotStatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type LotBadgeCopy = {
  label: string;
  tone: LotStatusTone;
  /** A live lot wears the neutral badge with a dot; red is kept for outbid and overdue. */
  dot: boolean;
};

/** Which figure leads the price block. */
export type LotHeadlineSource = "starting" | "current" | "sold" | "result" | "none";

/** What the time line reports. */
export type LotTimeLineKind = "opens" | "closes" | "ended" | "none";

/** The one thing a bidder can do next, before the viewer's own position is considered. */
export type LotActionKind =
  | "register_or_set_maximum"
  | "bid"
  | "bid_and_watch_saleroom"
  | "bid_disabled"
  | "get_artist_alerts"
  | "enquire"
  | "back_to_sale"
  | "none";

export type LotLifecycleCopy = {
  badge: LotBadgeCopy;
  headline: LotHeadlineSource;
  /** The label above the headline figure. */
  headlineLabel: string;
  timeLine: LotTimeLineKind;
  action: LotActionKind;
  /** Bidding is open or about to open, so a next bid and a live feed make sense. */
  biddingOpen: boolean;
  /** The sticky phone bar shows for this lifecycle. */
  phoneBar: boolean;
};

export const LOT_LIFECYCLE_COPY: Readonly<Record<LotLifecycleKind, LotLifecycleCopy>> = {
  preLaunch: {
    badge: { label: "Preview", tone: "neutral", dot: false },
    headline: "starting",
    headlineLabel: "Starting bid",
    timeLine: "none",
    action: "none",
    biddingOpen: false,
    phoneBar: false,
  },
  scheduled: {
    badge: { label: "Opens soon", tone: "info", dot: false },
    headline: "starting",
    headlineLabel: "Starting bid",
    timeLine: "opens",
    action: "register_or_set_maximum",
    biddingOpen: true,
    phoneBar: true,
  },
  live: {
    badge: { label: "Live", tone: "neutral", dot: true },
    headline: "current",
    headlineLabel: "Current bid",
    timeLine: "closes",
    action: "bid",
    biddingOpen: true,
    phoneBar: true,
  },
  extended: {
    badge: { label: "Extended", tone: "warning", dot: true },
    headline: "current",
    headlineLabel: "Current bid",
    timeLine: "closes",
    action: "bid",
    biddingOpen: true,
    phoneBar: true,
  },
  liveSaleroom: {
    badge: { label: "Live · In the room", tone: "neutral", dot: true },
    headline: "current",
    headlineLabel: "Current bid",
    timeLine: "none",
    action: "bid_and_watch_saleroom",
    biddingOpen: true,
    phoneBar: true,
  },
  saleroomPaused: {
    badge: { label: "Paused", tone: "warning", dot: false },
    headline: "current",
    headlineLabel: "Current bid",
    timeLine: "none",
    action: "bid_disabled",
    biddingOpen: true,
    phoneBar: true,
  },
  endedSold: {
    badge: { label: "Sold", tone: "neutral", dot: false },
    headline: "sold",
    headlineLabel: "Sold for",
    timeLine: "ended",
    action: "get_artist_alerts",
    biddingOpen: false,
    phoneBar: false,
  },
  endedNoSale: {
    badge: { label: "Not sold", tone: "neutral", dot: false },
    headline: "result",
    headlineLabel: "Estimate",
    timeLine: "ended",
    action: "enquire",
    biddingOpen: false,
    phoneBar: false,
  },
  cancelled: {
    badge: { label: "Cancelled", tone: "neutral", dot: false },
    headline: "none",
    headlineLabel: "No price",
    timeLine: "none",
    action: "back_to_sale",
    biddingOpen: false,
    phoneBar: false,
  },
  withdrawn: {
    badge: { label: "Withdrawn", tone: "neutral", dot: false },
    headline: "none",
    headlineLabel: "No price",
    timeLine: "none",
    action: "back_to_sale",
    biddingOpen: false,
    phoneBar: false,
  },
};

export function lotLifecycleCopy(kind: LotLifecycleKind): LotLifecycleCopy {
  return LOT_LIFECYCLE_COPY[kind];
}

/** Lifecycles in which bidding is over: no next bid and no live feed. */
export function isLotLifecycleClosed(kind: LotLifecycleKind): boolean {
  return !LOT_LIFECYCLE_COPY[kind].biddingOpen && kind !== "preLaunch";
}

/** Lifecycles that run on a clock the page counts down (the room's auctioneer closes the rest). */
export function lotLifecycleHasCountdown(kind: LotLifecycleKind): boolean {
  return LOT_LIFECYCLE_COPY[kind].timeLine === "closes";
}
