"use client";

import { LotStatePill } from "@/components/sections/artwork/online/lot-state-pill";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import type { Lot, Sale } from "@auction/types";
import { useMemo } from "react";

type LotPick = Pick<
  Lot,
  "status" | "startTime" | "endTime" | "winnerId" | "reservePrice" | "currentPrice" | "id"
>;
type SalePick =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

type Props = {
  lot: LotPick;
  sale: SalePick;
  initialNowMs?: number;
};

/** Sticky header pill; countdown hidden below `lg` (mobile sticky bar owns the timer). */
export function LotSessionStatePill({ lot, sale, initialNowMs }: Props) {
  const onlineLifecycle = useOnlineLotLifecycle();
  const effectiveLot = useMemo(() => {
    let effective = lot;
    if (onlineLifecycle?.liveEndTimeMs != null) {
      effective = { ...effective, endTime: new Date(onlineLifecycle.liveEndTimeMs) };
    }
    if (onlineLifecycle?.liveLotStatus != null) {
      effective = {
        ...effective,
        status: onlineLifecycle.liveLotStatus,
        ...(onlineLifecycle.liveLotStatus === "ended"
          ? { winnerId: onlineLifecycle.liveWinnerId ?? null }
          : {}),
      };
    }
    return effective;
  }, [
    lot,
    onlineLifecycle?.liveEndTimeMs,
    onlineLifecycle?.liveLotStatus,
    onlineLifecycle?.liveWinnerId,
  ]);

  return (
    <LotStatePill
      lot={effectiveLot}
      sale={sale}
      hideCountdownOnMobile
      {...(initialNowMs !== undefined ? { initialNowMs } : {})}
    />
  );
}
