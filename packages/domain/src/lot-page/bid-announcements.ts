import type { BidMode } from "./bid-entry.js";
import type { LotPosition } from "./viewer-state.js";

type Money = { money(amount: string): string };

/** What a screen reader hears once a bid or a maximum has been accepted. */
export function bidPlacedAnnouncement(input: {
  mode: BidMode;
  amount: string;
  format: Money;
}): string {
  const amount = input.format.money(input.amount);
  return input.mode === "maximum" ? `Maximum set at ${amount}.` : `Bid placed at ${amount}.`;
}

const LEADING_POSITIONS: ReadonlySet<LotPosition> = new Set(["leading", "maximum_set"]);

export type PositionChange = {
  from: LotPosition;
  to: LotPosition;
  lotTitle: string;
  /** The lot's current price. */
  currentPrice: string;
  nextBid: string | null;
  format: Money;
};

/**
 * What to say when the viewer's standing on the lot changes: leading once they take the lead,
 * outbid when they lose it. Other bidders' prices are not announced, so a busy close does not
 * flood a screen reader. `null` when nothing the viewer needs to know has changed.
 */
export function positionAnnouncement(change: PositionChange): string | null {
  if (change.from === change.to) return null;
  if (change.to === "leading" && !LEADING_POSITIONS.has(change.from)) {
    return `You're the highest bidder at ${change.format.money(change.currentPrice)}.`;
  }
  if (change.to === "outbid" && LEADING_POSITIONS.has(change.from)) {
    const next = change.nextBid ? ` The next bid is ${change.format.money(change.nextBid)}.` : "";
    return `You've been outbid on ${change.lotTitle}.${next}`;
  }
  return null;
}
