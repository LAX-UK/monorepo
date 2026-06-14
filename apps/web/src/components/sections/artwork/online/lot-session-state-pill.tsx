"use client";

import { LotStatePill } from "@/components/sections/artwork/online/lot-state-pill";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import type { Lot, Sale } from "@auction/types";
import { useMemo } from "react";

type LotPick = Pick<
  Lot,
  "status" | "startTime" | "endTime" | "winnerId" | "reservePrice" | "currentPrice" | "id"
>;
type SalePick = Pick<Sale, "status" | "deliveryMode"> | null;

type Props = {
  lot: LotPick;
  sale: SalePick;
  initialNowMs?: number;
};

/** Sticky header pill; countdown hidden below `lg` (mobile sticky bar owns the timer). */
export function LotSessionStatePill({ lot, sale, initialNowMs }: Props) {
  const onlineLifecycle = useOnlineLotLifecycle();
  const effectiveLot = useMemo(() => {
    if (onlineLifecycle?.liveEndTimeMs == null) return lot;
    return { ...lot, endTime: new Date(onlineLifecycle.liveEndTimeMs) };
  }, [lot, onlineLifecycle?.liveEndTimeMs]);

  return (
    <LotStatePill
      lot={effectiveLot}
      sale={sale}
      hideCountdownOnMobile
      {...(initialNowMs !== undefined ? { initialNowMs } : {})}
    />
  );
}
