import type { Lot } from "@auction/types";

export type DeriveInitialOutbidInput = {
  lotStatus: Lot["status"];
  sessionUserId: string | null;
  leadingBidderId: string | null;
  userHasBid: boolean;
};

/**
 * SSR-safe: user placed at least one bid but is not the current high bidder while lot is live.
 */
export function deriveInitialOutbid(input: DeriveInitialOutbidInput): boolean {
  const { lotStatus, sessionUserId, leadingBidderId, userHasBid } = input;
  if (lotStatus !== "active") return false;
  if (!sessionUserId || !userHasBid) return false;
  if (!leadingBidderId) return false;
  return leadingBidderId !== sessionUserId;
}

export function deriveUserHasBid(
  bids: ReadonlyArray<{
    bidderId?: string | null | undefined;
    placedByUserId?: string | null | undefined;
  }>,
  sessionUserId: string | null,
): boolean {
  if (!sessionUserId) return false;
  return bids.some((b) => (b.bidderId ?? b.placedByUserId ?? "") === sessionUserId);
}
