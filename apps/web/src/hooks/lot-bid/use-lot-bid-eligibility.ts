"use client";

import { type LotBidPosition, deriveLotBidPosition } from "@/lib/bid/derive-lot-bid-position";
import type { AutoBidSettings, SessionUser } from "@/lib/data/contracts";
import type { LotLifecycle } from "@/lib/lot/lot-lifecycle";
import type { LotReserveContext } from "@/lib/lot/reserve-presentation";
import type { Lot, LotEndedNoSaleReason, PublicLotView } from "@auction/types";
import { useMemo } from "react";

export type UseLotBidEligibilityParams = {
  auction: Lot | PublicLotView;
  sessionUser: SessionUser | null;
  lotStatus: Lot["status"];
  lifecycle: LotLifecycle;
  leadingBidderId: string | null;
  userHasBid: boolean;
  outbidSignal: boolean;
  activeAutoBid: AutoBidSettings | null;
  endedBanner: string | null;
  reserveContext: LotReserveContext;
  noSaleReason: LotEndedNoSaleReason | null;
  isOwnLot?: boolean;
};

export type UseLotBidEligibilityResult = {
  position: LotBidPosition;
};

export function useLotBidEligibility({
  auction,
  sessionUser,
  lotStatus,
  lifecycle,
  leadingBidderId,
  userHasBid,
  outbidSignal,
  activeAutoBid,
  endedBanner,
  reserveContext,
  noSaleReason,
  isOwnLot = false,
}: UseLotBidEligibilityParams): UseLotBidEligibilityResult {
  const position = useMemo(
    () =>
      deriveLotBidPosition({
        sessionUserId: sessionUser?.id ?? null,
        sellerId: auction.sellerId ?? null,
        isOwnLot,
        lotStatus,
        lifecycleKind: lifecycle.kind,
        leadingBidderId,
        winnerId:
          lotStatus === "ended"
            ? (leadingBidderId ?? auction.winnerId ?? null)
            : (auction.winnerId ?? null),
        userHasBid,
        outbidSignal,
        activeAutoBid,
        endedBanner,
        reserveContext,
        noSaleReason,
      }),
    [
      sessionUser?.id,
      auction.sellerId,
      isOwnLot,
      auction.winnerId,
      lotStatus,
      lifecycle.kind,
      leadingBidderId,
      userHasBid,
      outbidSignal,
      activeAutoBid,
      endedBanner,
      reserveContext,
      noSaleReason,
    ],
  );

  return { position };
}
