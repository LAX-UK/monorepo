export type OwnBidEchoGuard = {
  bidId: string;
  amount: string;
  leadingBidderId: string | null;
  at: number;
};

type BidEchoEvent = {
  bidId: string;
  amount: string;
  emittedAt?: number | undefined;
};

/** Skip websocket echoes that race behind a successful own-bid HTTP response. */
export function shouldSkipOwnBidEcho(
  event: BidEchoEvent,
  own: OwnBidEchoGuard | null,
  sessionUserId: string | null | undefined,
): boolean {
  if (!own) return false;
  if (event.bidId === own.bidId) return true;
  if (
    sessionUserId &&
    own.leadingBidderId === sessionUserId &&
    Number.parseFloat(event.amount) < Number.parseFloat(own.amount) &&
    Date.now() - own.at < 5000
  ) {
    return true;
  }
  if (event.emittedAt != null && event.emittedAt < own.at) return true;
  return false;
}
